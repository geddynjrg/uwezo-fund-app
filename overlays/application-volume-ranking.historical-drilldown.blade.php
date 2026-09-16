@php
    $stats = $this->applicationVolumeStats;
    $detailOpen = filled($applicationVolumeDetailCode);
    $overview = $detailOpen ? $this->applicationVolumeConstituencyOverview : null;
    $phaseGroups = $applicationVolumeDetailPhaseId ? $this->applicationVolumePhaseGroups : null;
    $groupDetail = $applicationVolumeDetailGroupLoanId ? $this->applicationVolumeGroupDetail : null;
    $rows = $detailOpen ? [] : $this->filteredApplicationVolumeRows;
    $maxCount = $stats['max_count'] ?: 1;
@endphp

<div class="application-volume-panel" wire:key="application-volume-panel">
    <div class="d-flex flex-wrap justify-content-between align-items-start mb-3">
        <div>
            <h6 class="font-weight-bold mb-1">
                <i class="fas fa-clipboard-list mr-2 text-success"></i>{{ $title ?? 'Applications by constituency' }}
            </h6>
            <p class="text-muted small mb-0">
                All {{ number_format($stats['constituency_count']) }} constituencies ranked highest to lowest.
                Portal = loan portal applications (any stage, including submitted to HQ). Historical = financed group loans on historical/completed phases only (no double-count).
                Click a constituency → phase → group → members.
            </p>
        </div>
        <span class="hq-badge-v2">{{ number_format($stats['total']) }} total records</span>
    </div>

    @unless($detailOpen)
        <div class="row mb-3">
            <div class="col-md-3 col-6 mb-2 mb-md-0">
                <div class="application-volume-kpi">
                    <div class="kpi-label">National total</div>
                    <div class="kpi-value hq-count-up" data-count-up="{{ $stats['total'] }}">0</div>
                </div>
            </div>
            <div class="col-md-3 col-6 mb-2 mb-md-0">
                <div class="application-volume-kpi">
                    <div class="kpi-label">With records</div>
                    <div class="kpi-value hq-count-up" data-count-up="{{ $stats['active_constituencies'] }}">0</div>
                    <small class="text-muted">of <span class="hq-count-up" data-count-up="{{ $stats['constituency_count'] }}">0</span></small>
                </div>
            </div>
            <div class="col-md-3 col-6 mb-2 mb-md-0">
                <div class="application-volume-kpi">
                    <div class="kpi-label">Highest volume</div>
                    <div class="kpi-value" style="font-size: 1rem;">{{ $stats['top_name'] ?? '—' }}</div>
                    <small class="text-muted"><span class="hq-count-up" data-count-up="{{ $stats['top_count'] }}">0</span></small>
                </div>
            </div>
            <div class="col-md-3 col-6">
                <div class="application-volume-kpi">
                    <div class="kpi-label">Showing</div>
                    <div class="kpi-value hq-count-up" data-count-up="{{ count($this->filteredApplicationVolumeRows) }}">0</div>
                    <small class="text-muted">constituencies</small>
                </div>
            </div>
        </div>

        <div class="mb-3">
            <input type="search"
                   wire:model.live.debounce.300ms="applicationVolumeSearch"
                   class="form-control form-control-sm"
                   placeholder="Search constituency or county…"
                   style="max-width: 320px;">
        </div>

        <div class="application-volume-table-wrap table-responsive">
            <table class="table table-sm table-hover application-volume-table mb-0">
                <thead>
                    <tr>
                        <th style="width: 3rem;">#</th>
                        <th>Constituency</th>
                        <th>County</th>
                        <th class="text-right">Portal</th>
                        <th class="text-right">Historical</th>
                        <th class="text-right">Total</th>
                        <th style="min-width: 140px;">Share</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse($this->filteredApplicationVolumeRows as $index => $row)
                        @php
                            $share = $maxCount > 0 ? ($row->application_count / $maxCount) * 100 : 0;
                        @endphp
                        <tr
                            class="application-volume-row {{ $row->application_count === 0 ? 'text-muted' : '' }}"
                            role="button"
                            tabindex="0"
                            wire:key="av-row-{{ $row->constituency_code }}"
                            wire:click="openApplicationVolumeConstituency('{{ $row->constituency_code }}')"
                            wire:keydown.enter="openApplicationVolumeConstituency('{{ $row->constituency_code }}')"
                            title="Open historical phases"
                        >
                            <td class="text-muted">{{ $row->rank ?? ($index + 1) }}</td>
                            <td class="font-weight-bold">
                                {{ $row->constituency_name }}
                                @if($row->historical_records > 0)
                                    <i class="fas fa-chevron-right ml-1 text-success" style="font-size: 0.65rem;"></i>
                                @endif
                            </td>
                            <td>{{ $row->county_name }}</td>
                            <td class="text-right">{{ number_format($row->portal_applications) }}</td>
                            <td class="text-right">{{ number_format($row->historical_records) }}</td>
                            <td class="text-right font-weight-bold">{{ number_format($row->application_count) }}</td>
                            <td>
                                <div class="d-flex align-items-center">
                                    <div class="application-volume-share-track flex-grow-1 mr-2">
                                        <div class="application-volume-share-fill"
                                             style="width: {{ $row->application_count > 0 ? max($share, 2) : 0 }}%;"></div>
                                    </div>
                                    <small class="text-muted text-nowrap">{{ number_format($share, 0) }}%</small>
                                </div>
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="7" class="text-center text-muted py-4">No constituencies match your search.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    @endunless

    @if($detailOpen && $overview && $overview['constituency'])
        @php
            $c = $overview['constituency'];
            $summary = $overview['summary'];
        @endphp
        <div class="application-volume-detail-backdrop" wire:click="closeApplicationVolumeConstituency"></div>
        <div class="application-volume-detail-panel" wire:click.stop wire:key="av-detail-{{ $applicationVolumeDetailCode }}-{{ $applicationVolumeDetailPhaseId }}-{{ $applicationVolumeDetailGroupLoanId }}">
            <div wire:loading.flex class="application-volume-detail-loading">
                <div class="spinner-border text-success" role="status"></div>
                <span class="ml-2">Loading…</span>
            </div>

            <div class="d-flex flex-wrap justify-content-between align-items-start mb-3">
                <div>
                    <nav class="application-volume-breadcrumb mb-2">
                        <button type="button" class="btn btn-link btn-sm p-0" wire:click="closeApplicationVolumeConstituency">Ranking</button>
                        <span class="mx-1 text-muted">/</span>
                        <button type="button"
                                class="btn btn-link btn-sm p-0 {{ !$applicationVolumeDetailPhaseId ? 'font-weight-bold text-dark' : '' }}"
                                wire:click="backApplicationVolumeToPhases">
                            {{ $c->constituency_name }}
                        </button>
                        @if($phaseGroups && $phaseGroups['phase'])
                            <span class="mx-1 text-muted">/</span>
                            <button type="button"
                                    class="btn btn-link btn-sm p-0 {{ !$applicationVolumeDetailGroupLoanId ? 'font-weight-bold text-dark' : '' }}"
                                    wire:click="backApplicationVolumeToGroups">
                                {{ $phaseGroups['phase']->phase }}
                            </button>
                        @endif
                        @if($groupDetail && $groupDetail['loan'])
                            <span class="mx-1 text-muted">/</span>
                            <span class="small font-weight-bold">{{ $groupDetail['loan']->group_name }}</span>
                        @endif
                    </nav>
                    <h5 class="mb-1 font-weight-bold">
                        <i class="fas fa-history mr-2 text-success"></i>
                        @if($groupDetail && $groupDetail['loan'])
                            {{ $groupDetail['loan']->group_name }}
                        @elseif($phaseGroups && $phaseGroups['phase'])
                            {{ $phaseGroups['phase']->phase }} groups
                        @else
                            {{ $c->constituency_name }}
                            <span class="text-muted font-weight-normal">· {{ $c->county_name }}</span>
                        @endif
                    </h5>
                    <p class="text-muted small mb-0">
                        @if($groupDetail && $groupDetail['loan'])
                            Group loan details and individual applicants/members.
                        @elseif($phaseGroups && $phaseGroups['phase'])
                            Financed groups on this historical phase. Click a group for full details.
                        @else
                            Historical phases for this constituency. Click a phase to open its groups.
                        @endif
                    </p>
                </div>
                <button type="button"
                        class="btn btn-sm btn-outline-secondary"
                        wire:click="closeApplicationVolumeConstituency"
                        wire:loading.attr="disabled">
                    <i class="fas fa-times mr-1"></i> Close
                </button>
            </div>

            {{-- Level 1: phases --}}
            @if(!$applicationVolumeDetailPhaseId)
                <div class="row mb-3">
                    <div class="col-md-4 col-6 mb-2">
                        <div class="application-volume-kpi">
                            <div class="kpi-label">Historical loans</div>
                            <div class="kpi-value" style="font-size: 1.4rem;">{{ number_format($summary['count']) }}</div>
                        </div>
                    </div>
                    <div class="col-md-4 col-6 mb-2">
                        <div class="application-volume-kpi">
                            <div class="kpi-label">Amount issued</div>
                            <div class="kpi-value" style="font-size: 1.1rem;">KES {{ number_format($summary['amount']) }}</div>
                        </div>
                    </div>
                    <div class="col-md-4 col-12 mb-2">
                        <div class="application-volume-kpi">
                            <div class="kpi-label">Phases</div>
                            <div class="kpi-value" style="font-size: 1.4rem;">{{ number_format(count($summary['phases'])) }}</div>
                        </div>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="table table-sm table-hover mb-0">
                        <thead>
                            <tr>
                                <th>Phase</th>
                                <th>Status</th>
                                <th class="text-right">Groups</th>
                                <th class="text-right">Issued</th>
                                <th class="text-right">Repaid</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            @forelse($summary['phases'] as $phase)
                                <tr class="application-volume-row"
                                    role="button"
                                    wire:key="av-phase-{{ $phase->id }}"
                                    wire:click="openApplicationVolumePhase({{ $phase->id }})">
                                    <td class="font-weight-bold">{{ $phase->phase }}</td>
                                    <td><span class="badge badge-light">{{ $phase->status }}</span></td>
                                    <td class="text-right">{{ number_format($phase->loan_count) }}</td>
                                    <td class="text-right">KES {{ number_format($phase->amount_issued) }}</td>
                                    <td class="text-right">KES {{ number_format($phase->amount_repaid) }}</td>
                                    <td class="text-right text-success"><i class="fas fa-chevron-right"></i></td>
                                </tr>
                            @empty
                                <tr>
                                    <td colspan="6" class="text-center text-muted py-4">No historical phases for this constituency.</td>
                                </tr>
                            @endforelse
                        </tbody>
                    </table>
                </div>
            @endif

            {{-- Level 2: groups in phase --}}
            @if($applicationVolumeDetailPhaseId && !$applicationVolumeDetailGroupLoanId && $phaseGroups)
                @php $pager = $phaseGroups['pagination']; @endphp
                <div class="d-flex flex-wrap justify-content-between align-items-center mb-2">
                    <input type="search"
                           wire:model.live.debounce.300ms="applicationVolumeDetailSearch"
                           class="form-control form-control-sm mb-2 mb-md-0"
                           placeholder="Search group, reg no, sector, ward…"
                           style="max-width: 360px;">
                    <small class="text-muted">
                        @if($pager['total'] > 0)
                            Showing {{ number_format($pager['from']) }}–{{ number_format($pager['to']) }}
                            of {{ number_format($pager['total']) }}
                        @else
                            No groups
                        @endif
                    </small>
                </div>

                <div class="table-responsive application-volume-detail-table-wrap">
                    <table class="table table-sm table-hover mb-0">
                        <thead>
                            <tr>
                                <th>Group</th>
                                <th>Reg no</th>
                                <th>Ward</th>
                                <th>Sector</th>
                                <th>Category</th>
                                <th class="text-right">Members</th>
                                <th class="text-right">Issued</th>
                                <th class="text-right">Repaid</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            @forelse($phaseGroups['rows'] as $loan)
                                <tr class="application-volume-row"
                                    role="button"
                                    wire:key="av-group-{{ $loan->id }}"
                                    wire:click="openApplicationVolumeGroup({{ $loan->id }})">
                                    <td class="font-weight-bold">{{ $loan->group_name }}</td>
                                    <td>{{ $loan->reg_number }}</td>
                                    <td>{{ $loan->ward_name }}</td>
                                    <td>{{ $loan->sector }}</td>
                                    <td>{{ $loan->category }}</td>
                                    <td class="text-right">{{ number_format($loan->member_count) }}</td>
                                    <td class="text-right">{{ number_format($loan->amount_issued) }}</td>
                                    <td class="text-right">{{ number_format($loan->amount_repaid) }}</td>
                                    <td class="text-right text-success"><i class="fas fa-chevron-right"></i></td>
                                </tr>
                            @empty
                                <tr>
                                    <td colspan="9" class="text-center text-muted py-4">No financed groups match this view.</td>
                                </tr>
                            @endforelse
                        </tbody>
                    </table>
                </div>

                @if($pager['last_page'] > 1)
                    <div class="d-flex justify-content-between align-items-center mt-3">
                        <button type="button"
                                class="btn btn-sm btn-outline-secondary"
                                wire:click="setApplicationVolumeDetailPage({{ max(1, $pager['current_page'] - 1) }})"
                                @if($pager['current_page'] <= 1) disabled @endif>
                            Previous
                        </button>
                        <small class="text-muted">Page {{ $pager['current_page'] }} of {{ $pager['last_page'] }}</small>
                        <button type="button"
                                class="btn btn-sm btn-outline-secondary"
                                wire:click="setApplicationVolumeDetailPage({{ min($pager['last_page'], $pager['current_page'] + 1) }})"
                                @if($pager['current_page'] >= $pager['last_page']) disabled @endif>
                            Next
                        </button>
                    </div>
                @endif
            @endif

            {{-- Level 3: group + members --}}
            @if($groupDetail && $groupDetail['loan'])
                @php $loan = $groupDetail['loan']; @endphp
                <div class="row mb-3">
                    <div class="col-md-6 mb-3">
                        <div class="application-volume-kpi h-100">
                            <div class="kpi-label mb-2">Group details</div>
                            <dl class="row mb-0 small">
                                <dt class="col-5 text-muted">Registration</dt><dd class="col-7">{{ $loan->reg_number }}</dd>
                                <dt class="col-5 text-muted">Ward</dt><dd class="col-7">{{ $loan->ward_name }}</dd>
                                <dt class="col-5 text-muted">Location</dt><dd class="col-7">{{ $loan->location }}</dd>
                                <dt class="col-5 text-muted">Bank</dt><dd class="col-7">{{ $loan->bank }}</dd>
                                <dt class="col-5 text-muted">Account</dt><dd class="col-7">{{ $loan->account }}</dd>
                                <dt class="col-5 text-muted">Formed</dt><dd class="col-7">{{ $loan->date_formed ?: '—' }}</dd>
                                <dt class="col-5 text-muted">Registered</dt><dd class="col-7">{{ $loan->date_registered ?: '—' }}</dd>
                                <dt class="col-5 text-muted">Status</dt><dd class="col-7">{{ $loan->group_status }}</dd>
                            </dl>
                        </div>
                    </div>
                    <div class="col-md-6 mb-3">
                        <div class="application-volume-kpi h-100">
                            <div class="kpi-label mb-2">Loan details</div>
                            <dl class="row mb-0 small">
                                <dt class="col-5 text-muted">Phase</dt><dd class="col-7">{{ $loan->phase }}</dd>
                                <dt class="col-5 text-muted">Sector</dt><dd class="col-7">{{ $loan->sector }}</dd>
                                <dt class="col-5 text-muted">Category</dt><dd class="col-7">{{ $loan->category }}</dd>
                                <dt class="col-5 text-muted">Approved</dt><dd class="col-7">KES {{ number_format($loan->amount_approved) }}</dd>
                                <dt class="col-5 text-muted">Issued</dt><dd class="col-7">KES {{ number_format($loan->amount_issued) }}</dd>
                                <dt class="col-5 text-muted">Repaid</dt><dd class="col-7">KES {{ number_format($loan->amount_repaid) }}</dd>
                                <dt class="col-5 text-muted">Arrears</dt><dd class="col-7">KES {{ number_format($loan->total_arrears) }}</dd>
                                <dt class="col-5 text-muted">Disbursed</dt><dd class="col-7">{{ $loan->disbursement_date ? \Illuminate\Support\Carbon::parse($loan->disbursement_date)->format('Y-m-d') : '—' }}</dd>
                                <dt class="col-5 text-muted">Cheque / GFS</dt><dd class="col-7">{{ $loan->cheque_no }} / {{ $loan->gfs_code }}</dd>
                            </dl>
                        </div>
                    </div>
                </div>

                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h6 class="mb-0 font-weight-bold">
                        <i class="fas fa-users mr-2 text-success"></i>
                        Applicants / members
                        <span class="badge badge-success ml-1">{{ number_format($loan->member_count) }}</span>
                    </h6>
                    <button type="button" class="btn btn-sm btn-outline-secondary" wire:click="backApplicationVolumeToGroups">
                        ← Back to groups
                    </button>
                </div>

                <div class="table-responsive application-volume-detail-table-wrap">
                    <table class="table table-sm table-hover mb-0">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Member ID</th>
                                <th>Phone</th>
                                <th>Gender</th>
                                <th>Role</th>
                                <th>PWD</th>
                            </tr>
                        </thead>
                        <tbody>
                            @forelse($groupDetail['members'] as $member)
                                <tr wire:key="av-member-{{ $member->group_member_id }}">
                                    <td class="font-weight-bold">{{ $member->name }}</td>
                                    <td>{{ $member->member_id }}</td>
                                    <td>{{ $member->number }}</td>
                                    <td>{{ $member->gender }}</td>
                                    <td>{{ $member->role }}</td>
                                    <td>{{ $member->disabled ? 'Yes' : 'No' }}</td>
                                </tr>
                            @empty
                                <tr>
                                    <td colspan="6" class="text-center text-muted py-4">
                                        No individual members were uploaded for this historical group loan.
                                    </td>
                                </tr>
                            @endforelse
                        </tbody>
                    </table>
                </div>
            @endif
        </div>
    @endif
</div>
