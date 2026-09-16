<?php

namespace App\Services\Loan;

use Carbon\Carbon;
use App\Models\GroupLoan;
use App\Models\Group;
use App\Models\Constituency;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class LoanAnalysisService
{
    public function analyzeSingleLoan(GroupLoan $loan)
    {
        $disbursementDate = Carbon::parse($loan->disbursement_date);
        $today = Carbon::now();
        $gracePeriodEnd = $disbursementDate->copy()->addMonths(6);

        // Grace Period Check
        if ($today->lte($gracePeriodEnd)) {
            return $this->formatResult(true, false, 0, 0, 0, $loan->amount_issued / 24);
        }

        // Repayment Math
        $repaymentStart = $gracePeriodEnd->copy()->addDay();
        $monthsInRepayment = min($repaymentStart->diffInMonths($today), 24);
        $monthlyInstallment = $loan->amount_issued / 24;

        $amountDue = $monthlyInstallment * $monthsInRepayment;
        $arrears = max($amountDue - $loan->amount_repaid, 0);

        $isDefaulted = $arrears > 0;
        $monthsDefaulted = $isDefaulted ? floor($arrears / $monthlyInstallment) : 0;

        // Active if within 30 months (6 grace + 24 repayment) OR still has arrears
        $isStillActive = $disbursementDate->diffInMonths($today) <= 30 || $arrears > 0;

        return $this->formatResult($isStillActive, $isDefaulted, $amountDue, $arrears, $monthsDefaulted, $monthlyInstallment);
    }


    private function formatResult($isStillActive, $isDefaulted, $due, $arrears, $months, $installment)
    {
        return [
            'is_active' => $isStillActive,
            'is_defaulted' => $isDefaulted,
            'amount_due' => $due,
            'arrears' => $arrears,
            'months_defaulted' => $months,
            'monthly_installment' => $installment,
        ];
    }

    public function analyzeGroupLoans(int $groupId): void
    {
        $groupLoans = GroupLoan::where('group_id', $groupId)
            ->where('loan_status', 'financed')
            ->orderBy('disbursement_date', 'asc')
            ->get();

        $sortedLoans = $groupLoans->sortBy(function ($loan) {
            return $loan->disbursement_date
                ? Carbon::parse($loan->disbursement_date)->timestamp
                : PHP_INT_MAX;
        });

        $loanResults = [];
        $globalExcessPool = 0;

        foreach ($sortedLoans as $index => $loan) {
            $result = $this->calculateLoanMetrics($loan, Carbon::now());
            $rawArrears = max($result['amount_due'] - $loan->amount_repaid, 0);
            $excessPayment = max($loan->amount_repaid - $result['amount_due'], 0);
            $globalExcessPool += $excessPayment;


            $loanResults[] = [
                'loan' => $loan,
                'result' => $result,
                'raw_arrears' => $rawArrears,
                'index' => $index,
            ];
        }

        $totalArrearsBefore = array_sum(array_column($loanResults, 'raw_arrears'));


        $adjustedCount = 0;
        foreach ($loanResults as &$entry) {
            $loanId = $entry['loan']->id;
            $rawArrears = $entry['raw_arrears'];
            $entry['pool_benefit'] = 0;

            if ($entry['raw_arrears'] > 0 && $globalExcessPool > 0) {
                $offset = min($entry['raw_arrears'], $globalExcessPool);
                $entry['adjusted_arrears'] = $entry['raw_arrears'] - $offset;
                $entry['pool_benefit'] = $offset;

                $globalExcessPool -= $offset;
                $adjustedCount++;

            } else {
                $entry['adjusted_arrears'] = $entry['raw_arrears'];
            }
        }
        unset($entry);

        $totalArrearsAfter = array_sum(array_column($loanResults, 'adjusted_arrears'));

        $processed = 0;
        $defaultedLoans = 0;
        $completedLoans = 0;
        $activeLoans = 0;

        foreach ($loanResults as $entry) {
            $processed++;
            $loan = $entry['loan'];
            $result = $entry['result'];
            $poolBenefit = $entry['pool_benefit'];
            $isStillActive = $result['is_active'] ?? true;
            $adjustedArrears = $entry['adjusted_arrears'];

            $remainingPrincipal = max($loan->amount_issued - $loan->amount_repaid, 0);
            $totalCoverage = $loan->amount_repaid + $poolBenefit + $globalExcessPool;

            $isFullyCovered = $totalCoverage >= $loan->amount_issued;

            $isDefaulted = $adjustedArrears > 0;
            $monthsDefaulted = $isDefaulted
                ? floor($adjustedArrears / max($result['monthly_installment'], 1))
                : 0;

            $oldStatus = $loan->status;
            $newStatus = $loan->status;

            if ($loan->amount_repaid >= $loan->amount_issued) {
                $newStatus = 'completed';
            }
            elseif ($adjustedArrears <= 0 && $isFullyCovered) {
                $newStatus = 'completed';
            }
            elseif ($adjustedArrears <= 0) {
                $newStatus = 'active';
            }
            elseif ($isDefaulted) {
                $newStatus = 'defaulted';
                if($monthsDefaulted <= 0) $monthsDefaulted = 1;
            }

            $updateData = [
                'is_defaulted' => $isDefaulted,
                'months_defaulted' => (int)$monthsDefaulted,
                'total_arrears' => $adjustedArrears,
                'amount_due' => $result['amount_due'],
                'default_status_updated_at' => now(),
                'status' => $newStatus,
            ];

            $loan->update($updateData);
        }
    }

    private function calculateLoanMetrics(GroupLoan $loan, Carbon $today): array
    {
        $disbursementDate = Carbon::parse($loan->disbursement_date);
        $gracePeriodEnd = $disbursementDate->copy()->addMonths(6);

        $monthlyInstallment = $loan->amount_issued > 0 ? $loan->amount_issued / 24 : 0;

        if ($today->lte($gracePeriodEnd)) {
            // Grace period: no repayment due
            $amountDue = 0.0;
            $isStillActive = true;
            $isDefaulted = false;
            $monthsDefaulted = 0;
            $arrears = 0.0;
        } else {
            // Repayment period
            $repaymentStart = $gracePeriodEnd->copy()->addDay();
            $monthsElapsed = $repaymentStart->diffInMonths($today);
            $theoreticalDue = $monthlyInstallment * min($monthsElapsed, 24);

            // No cap on theoretical due
            $amountDue = $theoreticalDue;

            $isStillActive = $disbursementDate->diffInMonths($today) <= 30 || $theoreticalDue > $loan->amount_repaid;
            $isDefaulted = false; // Calculated later with overpayment
            $monthsDefaulted = 0;
            $arrears = 0.0;
        }

        return $this->formatResult(
            $isStillActive,
            $isDefaulted,
            $amountDue,
            0.0, // arrears calculated later
            $monthsDefaulted,
            $monthlyInstallment
        );
    }

    /**
     * Calculate limits and balances for a group.
     */
    public function getEligibilityData(?Group $group, int $requeted = 0): array
    {

        // Default for New Groups
        if (!$group?->id) {
            return [
                'min' => 50000,
                'max' => $requeted > 0 ? min($requeted, 100000) : 100000,
                'balance' => 0,
                'can_borrow' => true
            ];
        }


        // Calculate Global Balance (Total Approved - Total Repaid)
        $balance = ($group->total_issued ?? 0) - ($group->total_repaid ?? 0);

        // Calculate Ceiling (2x Last Issued Amount)
        $lastLoan = $group->currentLoan;

        $maxCeiling = $lastLoan ? ($lastLoan->amount_issued * 2) : 100000;

        $maximum = $requeted > 0 ? min($requeted, $maxCeiling) : min($maxCeiling, 500000);

        return [
            'min' => 50000,
            'max' => $maximum,
            'balance' => $balance,
            'can_borrow' => $balance <= 0 // Eligibility check
        ];
    }

    public function getDashboardStats(array $filters = [])
    {
        $baseQuery = GroupLoan::query()->whereIn('loan_status', ['financed', 'cancelled']);

        if (!empty($filters['county_code'])) {
            $baseQuery->whereHas('group.ward.constituency', function ($q) use ($filters) {
                $q->where('county_code', $filters['county_code']);
            });
        }

        if (!empty($filters['constituency_code'])) {
            $baseQuery->whereHas('group.ward', function ($q) use ($filters) {
                $q->where('constituency_code', $filters['constituency_code']);
            });
        }

        if (!empty($filters['ward_id'])) {
            $baseQuery->whereHas('group', function ($q) use ($filters) {
                $q->where('ward_id', $filters['ward_id']);
            });
        }

        $totals = (clone $baseQuery)
            ->selectRaw('
                SUM(amount_approved) as approved,
                SUM(amount_issued) as issued,
                SUM(amount_repaid) as repaid,
                SUM(amount_due) as due,
                SUM(total_arrears) as arrears,
                COUNT(CASE WHEN is_defaulted = 1 THEN 1 END) as default_count,
                COUNT(*) as active_count,
                AVG(months_defaulted) as avg_months_defaulted
            ')->first();

        $categoryData = (clone $baseQuery)
            ->select(
                DB::raw('LOWER(category) as category_name'),
                DB::raw('count(*) as loan_count'),
                DB::raw('SUM(amount_issued) as total_issued')
            )
            ->groupBy(DB::raw('LOWER(category)'))
            ->get()
            ->keyBy('category_name');

        $sectorData = (clone $baseQuery)
            ->select(
                DB::raw('LOWER(sector) as sector_name'),
                DB::raw('count(*) as loan_count'),
                DB::raw('SUM(amount_issued) as total_issued')
            )
            ->groupBy(DB::raw('LOWER(sector)'))
            ->get()
            ->keyBy('sector_name');

        // Include HQ-bound applications so constituency→HQ submissions appear on dashboards.
        $newApplications = DB::table('temp_applications')
            ->whereIn('status', [
                'submitted',
                'under_constituency_review',
                'under_hq_review',
                'pending_secretariat_review',
            ])
            ->when(!empty($filters['county_code']), fn($q) => $q->where('county_code', $filters['county_code']))
            ->when(!empty($filters['constituency_code']), fn($q) => $q->where('constituency_code', $filters['constituency_code']))
            ->when(!empty($filters['ward_id']), fn($q) => $q->where('ward_id', $filters['ward_id']))
            ->select(
                'application_id',
                'group_name',
                'loan_amount',
                'created_at',
                'nature_of_group',
                'business_type',
                'application_id',
                'key_activities',
                'status'
            )
            ->latest()
            ->limit(8)
            ->get();

        $approvedPhases = DB::table('loan_phases as lp')
            ->join('constituencies as c', 'lp.constituency_code', '=', 'c.constituency_code')
            ->join('counties as co', 'c.county_code', '=', 'co.county_code')
            ->whereIn('status', ['approved', 'in_training', 'disbursed'])
            ->when(!empty($filters['county_code']), fn($q) => $q->where('co.county_code', $filters['county_code']))
            ->when(!empty($filters['constituency_code']), fn($q) => $q->where('lp.constituency_code', $filters['constituency_code']))
            ->select(
                'lp.id',
                'lp.phase_ref',
                'lp.slug',
                'lp.constituency_code',
                'lp.phase',
                'lp.total_amount_approved'
            )
            ->latest('hq_approved_at')
            ->limit(5)
            ->get();

        $topConstituencies = [];
        $bottomConstituencies = [];

        if (empty($filters['constituency_code'])) {
            $rankingQuery = DB::table('group_loans as gl')
                ->join('loan_phases as lp', 'gl.loan_phase_id', '=', 'lp.id')
                ->join('constituencies as c', 'lp.constituency_code', '=', 'c.constituency_code')
                ->where('gl.loan_status', 'financed');

            if (!empty($filters['county_code'])) {
                $rankingQuery->where('c.county_code', $filters['county_code']);
            }

            $topConstituencies = (clone $rankingQuery)
                ->select(
                    'c.constituency_name', 'c.constituency_code',
                    DB::raw('SUM(gl.amount_repaid) as total_repaid'),
                    DB::raw('SUM(gl.amount_due) as total_due'),
                    DB::raw('CASE WHEN SUM(gl.amount_due) > 0 THEN ROUND((SUM(gl.amount_repaid) / SUM(gl.amount_due)) * 100, 1) ELSE 0 END as recovery_rate')
                )
                ->groupBy('c.constituency_code', 'c.constituency_name')
                ->orderByDesc('recovery_rate')->limit(5)->get();

            $bottomConstituencies = (clone $rankingQuery)
                ->select(
                    'c.constituency_name', 'c.constituency_code',
                    DB::raw('SUM(gl.total_arrears) as total_arrears'),
                    DB::raw('CASE WHEN SUM(gl.amount_due) > 0 THEN ROUND((SUM(gl.amount_repaid) / SUM(gl.amount_due)) * 100, 1) ELSE 0 END as recovery_rate')
                )
                ->groupBy('c.constituency_code', 'c.constituency_name')
                ->orderBy('recovery_rate', 'asc')->limit(5)->get();
        }

        $repaid = $totals->repaid ?? 0;
        $due = $totals->due ?? 0;
        $issued = $totals->issued ?? 0;

        return [
            'totalGroups' => (clone $baseQuery)->distinct('group_id')->count(),
            'totalAmountApproved' => $totals->approved ?? 0,
            'totalAmountIssued' => $totals->issued ?? 0,
            'totalAmountRepaid' => $totals->repaid ?? 0,
            'totalAmountDue' => $totals->due ?? 0,
            'totalArrears' => $totals->arrears ?? 0,
            'activeLoansCount' => $totals->active_count ?? 0,
            'defaultedLoansCount' => $totals->default_count ?? 0,
            'averageDefaultMonths' => round($totals->avg_months_defaulted ?? 0, 1),

            'recoveryRate' => $due > 0 ? round(($repaid / $due) * 100, 1) : 0,

            'repaymentProgressRate' => $issued > 0 ? round(($repaid / $issued) * 100, 1) : 0,

            'defaultRate' => ($totals->active_count ?? 0) > 0
                ? round(($totals->default_count / $totals->active_count) * 100, 1)
                : 0,

            'financialDefaultRate' => $totals->due > 0
                ? round((max($totals->due - $totals->repaid, 0) / $totals->due) * 100, 1)
                : 0,

            'averageArrearsPerDefaultedLoan' => $totals->default_count > 0
                ? round($totals->arrears / $totals->default_count, 0)
                : 0,

            'sector_breakdown' => $sectorData,

            'womenGroups' => $categoryData['women']->loan_count ?? 0,
            'womenAmount' => $categoryData['women']->total_issued ?? 0,

            'youthGroups' => $categoryData['youth']->loan_count ?? 0,
            'youthAmount' => $categoryData['youth']->total_issued ?? 0,

            'pwdGroups'   => $categoryData['pwd']->loan_count ?? 0,
            'pwdAmount'   => $categoryData['pwd']->total_issued ?? 0,

            'newApplications' => $newApplications,

            'approvedPhases' => $approvedPhases,

            'topPerformingConstituencies' => $topConstituencies,

            'bottomPerformingConstituencies' => $bottomConstituencies,

            'applicationsPerConstituency' => $this->getApplicationsPerConstituency($filters),
        ];
    }

    /**
     * Portal + historical application volume per constituency.
     *
     * Portal: distinct temp_applications. When linked to a phase, attribute to
     * the phase constituency so constituency→HQ submissions still count under
     * the submitting constituency even if temp.constituency_code is null/wrong.
     * Unassigned portal apps use temp_applications.constituency_code.
     *
     * Historical: financed group_loans on phases that have no portal
     * phase_applications (historical upload / completed-data phases only).
     * Excludes cancelled loans and avoids double-counting portal-linked loans.
     *
     * @param  array{county_code?: string, constituency_code?: string}  $filters
     * @return list<object{
     *     constituency_code: string,
     *     constituency_name: string,
     *     county_name: string,
     *     application_count: int,
     *     portal_applications: int,
     *     historical_records: int
     * }>
     */
    public function getApplicationsPerConstituency(array $filters = []): array
    {
        // Portal apps already attached to a phase (includes submitted_to_hq).
        $portalLinked = DB::table('phase_applications as pa')
            ->join('loan_phases as lp', 'pa.loan_phase_id', '=', 'lp.id')
            ->whereNotNull('pa.temp_application_id')
            ->select(
                'lp.constituency_code',
                'pa.temp_application_id'
            )
            ->distinct();

        // Portal apps not yet on any phase.
        $portalUnlinked = DB::table('temp_applications as ta')
            ->leftJoin('phase_applications as pa', 'pa.temp_application_id', '=', 'ta.id')
            ->whereNull('pa.id')
            ->whereNotNull('ta.constituency_code')
            ->select(
                'ta.constituency_code',
                'ta.id as temp_application_id'
            );

        $portalUnion = $portalLinked->unionAll($portalUnlinked);

        $portalCounts = DB::query()
            ->fromSub($portalUnion, 'portal_apps')
            ->select(
                'constituency_code',
                DB::raw('COUNT(DISTINCT temp_application_id) as portal_count')
            )
            ->groupBy('constituency_code');

        // Pure historical phases: no portal phase_applications on the phase.
        $historicalCounts = DB::table('group_loans as gl')
            ->join('loan_phases as lp', 'gl.loan_phase_id', '=', 'lp.id')
            ->where('gl.loan_status', 'financed')
            ->whereNotExists(function ($q) {
                $q->select(DB::raw(1))
                    ->from('phase_applications as pa')
                    ->whereColumn('pa.loan_phase_id', 'lp.id')
                    ->whereNotNull('pa.temp_application_id');
            })
            ->select('lp.constituency_code', DB::raw('COUNT(*) as historical_count'))
            ->groupBy('lp.constituency_code');

        return DB::table('constituencies as c')
            ->join('counties as co', 'c.county_code', '=', 'co.county_code')
            ->leftJoinSub($portalCounts, 'ta', 'ta.constituency_code', '=', 'c.constituency_code')
            ->leftJoinSub($historicalCounts, 'hg', 'hg.constituency_code', '=', 'c.constituency_code')
            ->when(!empty($filters['county_code']), fn ($q) => $q->where('c.county_code', $filters['county_code']))
            ->when(!empty($filters['constituency_code']), fn ($q) => $q->where('c.constituency_code', $filters['constituency_code']))
            ->select(
                'c.constituency_code',
                'c.constituency_name',
                'co.county_name',
                DB::raw('COALESCE(ta.portal_count, 0) + COALESCE(hg.historical_count, 0) as application_count'),
                DB::raw('COALESCE(ta.portal_count, 0) as portal_applications'),
                DB::raw('COALESCE(hg.historical_count, 0) as historical_records'),
            )
            ->orderByDesc('application_count')
            ->orderBy('c.constituency_name')
            ->get()
            ->map(fn ($row) => (object) [
                'constituency_code' => $row->constituency_code,
                'constituency_name' => $row->constituency_name,
                'county_name' => $row->county_name,
                'application_count' => (int) $row->application_count,
                'portal_applications' => (int) $row->portal_applications,
                'historical_records' => (int) $row->historical_records,
            ])
            ->all();
    }

    /**
     * Historical phases for a constituency (dashboard drill-down level 1).
     * Same definition as historical_records: financed loans on phases with no portal apps.
     */
    public function getHistoricalConstituencyOverview(string $constituencyCode): array
    {
        $constituency = DB::table('constituencies as c')
            ->join('counties as co', 'c.county_code', '=', 'co.county_code')
            ->where('c.constituency_code', $constituencyCode)
            ->select(
                'c.constituency_code',
                'c.constituency_name',
                'c.slug as constituency_slug',
                'co.county_name',
                'co.slug as county_slug'
            )
            ->first();

        $phaseIds = $this->historicalPhaseIdsForConstituency($constituencyCode);

        if ($phaseIds === []) {
            return [
                'constituency' => $constituency,
                'summary' => ['count' => 0, 'amount' => 0.0, 'member_count' => 0, 'phases' => []],
            ];
        }

        $phases = DB::table('loan_phases as lp')
            ->join('group_loans as gl', function ($join) {
                $join->on('gl.loan_phase_id', '=', 'lp.id')
                    ->where('gl.loan_status', '=', 'financed');
            })
            ->whereIn('lp.id', $phaseIds)
            ->select(
                'lp.id',
                'lp.phase',
                'lp.slug',
                'lp.status',
                DB::raw('COUNT(gl.id) as loan_count'),
                DB::raw('COALESCE(SUM(gl.amount_issued), 0) as amount_issued'),
                DB::raw('COALESCE(SUM(gl.amount_repaid), 0) as amount_repaid')
            )
            ->groupBy('lp.id', 'lp.phase', 'lp.slug', 'lp.status')
            ->orderBy('lp.phase')
            ->get()
            ->map(fn ($row) => (object) [
                'id' => (int) $row->id,
                'phase' => $row->phase,
                'slug' => $row->slug,
                'status' => $row->status,
                'loan_count' => (int) $row->loan_count,
                'amount_issued' => (float) $row->amount_issued,
                'amount_repaid' => (float) $row->amount_repaid,
            ])
            ->all();

        return [
            'constituency' => $constituency,
            'summary' => [
                'count' => (int) array_sum(array_map(fn ($p) => $p->loan_count, $phases)),
                'amount' => (float) array_sum(array_map(fn ($p) => $p->amount_issued, $phases)),
                'phases' => $phases,
            ],
        ];
    }

    /**
     * Paginated financed group loans for one historical phase (drill-down level 2).
     */
    public function getHistoricalPhaseGroups(
        int $phaseId,
        int $page = 1,
        int $perPage = 25,
        ?string $search = null
    ): array {
        $page = max(1, $page);
        $perPage = max(10, min(50, $perPage));
        $search = $search !== null ? trim($search) : '';

        $phase = DB::table('loan_phases as lp')
            ->join('constituencies as c', 'lp.constituency_code', '=', 'c.constituency_code')
            ->join('counties as co', 'c.county_code', '=', 'co.county_code')
            ->where('lp.id', $phaseId)
            ->select(
                'lp.id',
                'lp.phase',
                'lp.slug',
                'lp.status',
                'lp.constituency_code',
                'c.constituency_name',
                'co.county_name'
            )
            ->first();

        if (! $phase) {
            return [
                'phase' => null,
                'rows' => [],
                'pagination' => [
                    'current_page' => 1,
                    'last_page' => 1,
                    'per_page' => $perPage,
                    'total' => 0,
                    'from' => null,
                    'to' => null,
                ],
            ];
        }

        $base = DB::table('group_loans as gl')
            ->leftJoin('groups as g', 'gl.group_id', '=', 'g.id')
            ->leftJoin('wards as w', 'g.ward_id', '=', 'w.id')
            ->where('gl.loan_phase_id', $phaseId)
            ->where('gl.loan_status', 'financed');

        if ($search !== '') {
            $like = '%' . addcslashes($search, '%_\\') . '%';
            $base->where(function ($q) use ($like) {
                $q->where('g.name', 'like', $like)
                    ->orWhere('g.reg_number', 'like', $like)
                    ->orWhere('gl.sector', 'like', $like)
                    ->orWhere('gl.category', 'like', $like)
                    ->orWhere('w.ward_name', 'like', $like);
            });
        }

        $total = (int) (clone $base)->count('gl.id');
        $lastPage = max(1, (int) ceil($total / $perPage));
        if ($page > $lastPage) {
            $page = $lastPage;
        }
        $offset = ($page - 1) * $perPage;

        $rows = (clone $base)
            ->select(
                'gl.id',
                'g.name as group_name',
                'g.slug as group_slug',
                'g.reg_number',
                'g.bank',
                'g.account',
                'g.location',
                'w.ward_name',
                'gl.amount_issued',
                'gl.amount_repaid',
                'gl.amount_approved',
                'gl.sector',
                'gl.category',
                'gl.disbursement_date',
                'gl.cheque_no',
                'gl.gfs_code',
                DB::raw('(SELECT COUNT(*) FROM group_members gm WHERE gm.group_loans_id = gl.id) as member_count')
            )
            ->orderBy('g.name')
            ->offset($offset)
            ->limit($perPage)
            ->get()
            ->map(fn ($row) => (object) [
                'id' => (int) $row->id,
                'group_name' => $row->group_name ?: '—',
                'group_slug' => $row->group_slug,
                'reg_number' => $row->reg_number ?: '—',
                'bank' => $row->bank ?: '—',
                'account' => $row->account ?: '—',
                'location' => $row->location ?: '—',
                'ward_name' => $row->ward_name ?: '—',
                'amount_issued' => (float) ($row->amount_issued ?? 0),
                'amount_repaid' => (float) ($row->amount_repaid ?? 0),
                'amount_approved' => (float) ($row->amount_approved ?? 0),
                'sector' => $row->sector ?: '—',
                'category' => $row->category ?: '—',
                'disbursement_date' => $row->disbursement_date,
                'cheque_no' => $row->cheque_no ?: '—',
                'gfs_code' => $row->gfs_code ?: '—',
                'member_count' => (int) $row->member_count,
            ])
            ->all();

        $from = $total === 0 ? null : $offset + 1;
        $to = $total === 0 ? null : min($offset + $perPage, $total);

        return [
            'phase' => $phase,
            'rows' => $rows,
            'pagination' => [
                'current_page' => $page,
                'last_page' => $lastPage,
                'per_page' => $perPage,
                'total' => $total,
                'from' => $from,
                'to' => $to,
            ],
        ];
    }

    /**
     * Single financed group loan + members (drill-down level 3).
     */
    public function getHistoricalGroupDetail(int $groupLoanId): array
    {
        $loan = DB::table('group_loans as gl')
            ->leftJoin('groups as g', 'gl.group_id', '=', 'g.id')
            ->leftJoin('wards as w', 'g.ward_id', '=', 'w.id')
            ->leftJoin('loan_phases as lp', 'gl.loan_phase_id', '=', 'lp.id')
            ->where('gl.id', $groupLoanId)
            ->select(
                'gl.id',
                'gl.loan_phase_id',
                'gl.amount_applied',
                'gl.amount_approved',
                'gl.amount_issued',
                'gl.amount_repaid',
                'gl.amount_due',
                'gl.total_arrears',
                'gl.sector',
                'gl.category',
                'gl.sector_desc',
                'gl.loan_status',
                'gl.loan_type',
                'gl.disbursement_date',
                'gl.cheque_no',
                'gl.gfs_code',
                'gl.application_date',
                'g.name as group_name',
                'g.slug as group_slug',
                'g.reg_number',
                'g.bank',
                'g.account',
                'g.location',
                'g.box',
                'g.date_formed',
                'g.date_registered',
                'g.status as group_status',
                'w.ward_name',
                'lp.phase',
                'lp.slug as phase_slug',
                'lp.constituency_code'
            )
            ->first();

        if (! $loan) {
            return ['loan' => null, 'members' => []];
        }

        $members = DB::table('group_members as gm')
            ->join('members as m', 'gm.member_Id', '=', 'm.member_Id')
            ->where('gm.group_loans_id', $groupLoanId)
            ->select(
                'gm.id as group_member_id',
                'gm.role',
                'm.member_Id',
                'm.name',
                'm.number',
                'm.gender',
                'm.disabled'
            )
            ->orderBy('gm.role')
            ->orderBy('m.name')
            ->get()
            ->map(fn ($row) => (object) [
                'group_member_id' => (int) $row->group_member_id,
                'member_id' => $row->member_Id,
                'name' => $row->name ?: '—',
                'number' => $row->number ?: '—',
                'gender' => $row->gender ?: '—',
                'disabled' => (bool) $row->disabled,
                'role' => $row->role ?: 'Member',
            ])
            ->all();

        return [
            'loan' => (object) [
                'id' => (int) $loan->id,
                'loan_phase_id' => (int) $loan->loan_phase_id,
                'group_name' => $loan->group_name ?: '—',
                'group_slug' => $loan->group_slug,
                'reg_number' => $loan->reg_number ?: '—',
                'bank' => $loan->bank ?: '—',
                'account' => $loan->account ?: '—',
                'location' => $loan->location ?: '—',
                'box' => $loan->box ?: '—',
                'ward_name' => $loan->ward_name ?: '—',
                'date_formed' => $loan->date_formed,
                'date_registered' => $loan->date_registered,
                'group_status' => $loan->group_status ?: '—',
                'phase' => $loan->phase,
                'phase_slug' => $loan->phase_slug,
                'constituency_code' => $loan->constituency_code,
                'amount_applied' => (float) ($loan->amount_applied ?? 0),
                'amount_approved' => (float) ($loan->amount_approved ?? 0),
                'amount_issued' => (float) ($loan->amount_issued ?? 0),
                'amount_repaid' => (float) ($loan->amount_repaid ?? 0),
                'amount_due' => (float) ($loan->amount_due ?? 0),
                'total_arrears' => (float) ($loan->total_arrears ?? 0),
                'sector' => $loan->sector ?: '—',
                'category' => $loan->category ?: '—',
                'sector_desc' => $loan->sector_desc ?: '—',
                'loan_status' => $loan->loan_status ?: '—',
                'loan_type' => $loan->loan_type ?: '—',
                'disbursement_date' => $loan->disbursement_date,
                'cheque_no' => $loan->cheque_no ?: '—',
                'gfs_code' => $loan->gfs_code ?: '—',
                'application_date' => $loan->application_date,
                'member_count' => count($members),
            ],
            'members' => $members,
        ];
    }

    /**
     * @return list<int>
     */
    protected function historicalPhaseIdsForConstituency(string $constituencyCode): array
    {
        return DB::table('loan_phases as lp')
            ->where('lp.constituency_code', $constituencyCode)
            ->whereExists(function ($q) {
                $q->select(DB::raw(1))
                    ->from('group_loans as gl')
                    ->whereColumn('gl.loan_phase_id', 'lp.id')
                    ->where('gl.loan_status', 'financed');
            })
            ->whereNotExists(function ($q) {
                $q->select(DB::raw(1))
                    ->from('phase_applications as pa')
                    ->whereColumn('pa.loan_phase_id', 'lp.id')
                    ->whereNotNull('pa.temp_application_id');
            })
            ->pluck('lp.id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    public function countPhaseDuplicates(int $phaseId)
    {
        return DB::table('phase_applications')
            ->join('temp_applications', 'phase_applications.temp_application_id', '=', 'temp_applications.id')
            ->where('phase_applications.loan_phase_id', $phaseId)
            ->whereIn('temp_applications.group_registration_number', function($query) use ($phaseId) {
                $query->select('group_registration_number')
                    ->from('temp_applications')
                    ->join('phase_applications', 'temp_applications.id', '=', 'phase_applications.temp_application_id')
                    ->where('phase_applications.loan_phase_id', '!=', $phaseId)
                    ->whereIn('phase_applications.status', ['pending_hq_approval', 'approved', 'in_training']);
            })
            ->count();
    }

    public function getPhaseDuplicates(array $regNumbers, $currentPhaseId)
    {
        return DB::table('phase_applications')
            ->join('temp_applications', 'phase_applications.temp_application_id', '=', 'temp_applications.id')
            ->join('loan_phases', 'phase_applications.loan_phase_id', '=', 'loan_phases.id')
            ->join('constituencies', 'loan_phases.constituency_code', '=', 'constituencies.constituency_code')
            ->whereIn('temp_applications.group_registration_number', $regNumbers)
            ->where('phase_applications.loan_phase_id', '!=', $currentPhaseId)
            ->whereIn('phase_applications.status', ['pending_hq_approval', 'approved', 'in_training'])
            ->select('temp_applications.application_id', 'temp_applications.group_name', 'temp_applications.group_registration_number', 'constituencies.constituency_name as constituency_name', 'loan_phases.phase as phase_name')
            ->get()->groupBy('group_registration_number');
    }

    public function getIdentityMisMatch(array $regNumbers)
    {
        return DB::table('groups')
            ->select('reg_number', DB::raw('COUNT(DISTINCT name) as name_count'))
            ->whereIn('reg_number', $regNumbers)
            ->groupBy('reg_number')
            ->having('name_count', '>', 1)
            ->pluck('reg_number')->toArray();
    }

    public function getLegacyHistory(array $regNumbers)
    {
        return DB::table('group_loans')
            ->join('groups', 'group_loans.group_id', '=', 'groups.id')
            ->join('wards', 'groups.ward_id', '=', 'wards.id')
            ->join('constituencies', 'wards.constituency_code', '=', 'constituencies.constituency_code')
            ->whereIn('groups.reg_number', $regNumbers)
            ->where('group_loans.loan_status', 'financed')
            ->where(function($query) {
                $query->where('group_loans.is_defaulted', true)
                      ->orWhere('group_loans.total_arrears', '>', 0);
            })
            ->select(
                'groups.reg_number as group_registration_number',
                'groups.name as group_name',
                'constituencies.constituency_name as constituency_name',
                'group_loans.amount_issued',
                'group_loans.amount_repaid',
                DB::raw('(group_loans.amount_issued - group_loans.amount_repaid) as outstanding_balance')
            )
            ->get()
            ->groupBy('group_registration_number');
    }

    public function verifyDataIntegrity(array $regNumbers)
    {
        return DB::table('groups')
            ->select('reg_number', DB::raw('COUNT(DISTINCT name) as name_count'))
            ->whereIn('reg_number', $regNumbers)
            ->groupBy('reg_number')
            ->having('name_count', '>', 1)
            ->get()
            ->pluck('reg_number')
            ->toArray();
    }

    public function checkLegacyDebt(array $regNumbers)
    {
        // Get the actual debt records
        $debtRecords = DB::table('group_loans')
            ->join('groups', 'group_loans.group_id', '=', 'groups.id')
            ->join('wards', 'groups.ward_id', '=', 'wards.id')
            ->join('constituencies', 'wards.constituency_id', '=', 'constituencies.id')
            ->whereIn('groups.reg_number', $regNumbers)
            ->where(function($query) {
                $query->where('group_loans.is_defaulted', 1)
                      ->orWhere('group_loans.total_arrears', '>', 0);
            })
            ->whereIn('group_loans.loan_status', ['financed'])
            ->select(
                'groups.reg_number as application_id',
                'groups.name as legacy_name',
                'constituencies.name as constituency_name',
                'group_loans.amount_issued',
                'group_loans.amount_repaid',
                DB::raw('(group_loans.amount_issued - group_loans.amount_repaid) as outstanding_balance')
            )
            ->get()
            ->groupBy('application_id');

        // Identify reg_numbers with naming conflicts
        $conflictedRegNos = $this->verifyDataIntegrity($regNumbers);

        return [
            'records' => $debtRecords,
            'conflicts' => $conflictedRegNos
        ];
    }


    public function performGlobalCheck(array $regNumbers, $currentPhaseId)
    {
        return [
            'current' => $this->getPhaseDuplicates($regNumbers, $currentPhaseId),
            'legacy' => $this->getLegacyHistory($regNumbers),
        ];
    }
}
