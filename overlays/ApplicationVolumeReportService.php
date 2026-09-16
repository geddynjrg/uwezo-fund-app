<?php

namespace App\Services\Reports;

use App\Services\Loan\LoanAnalysisService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ApplicationVolumeReportService
{
    public const TYPES = [
        'constituencies' => 'Applications per constituency (national)',
        'phases' => 'Phases per constituency',
        'groups' => 'Group applications per phase',
        'members' => 'Group member details per application',
    ];

    public function __construct(protected LoanAnalysisService $analysisService)
    {
    }

    /**
     * @param  array{type:string,county_code?:string,constituency_code?:string,phase_id?:int|string|null,group_loan_id?:int|string|null,preview_limit?:int|null}  $params
     * @return array{type:string,title:string,headings:list<string>,rows:Collection,total:int,truncated:bool,filters:array}
     */
    public function build(array $params): array
    {
        $type = $params['type'] ?? 'constituencies';
        if (! isset(self::TYPES[$type])) {
            throw new \InvalidArgumentException('Unsupported report type: '.$type);
        }

        $previewLimit = isset($params['preview_limit']) ? (int) $params['preview_limit'] : null;
        $filters = [
            'county_code' => $params['county_code'] ?? null,
            'constituency_code' => $params['constituency_code'] ?? null,
            'phase_id' => isset($params['phase_id']) && $params['phase_id'] !== '' ? (int) $params['phase_id'] : null,
            'group_loan_id' => isset($params['group_loan_id']) && $params['group_loan_id'] !== '' ? (int) $params['group_loan_id'] : null,
        ];

        [$headings, $rows] = match ($type) {
            'constituencies' => $this->constituenciesReport($filters),
            'phases' => $this->phasesReport($filters),
            'groups' => $this->groupsReport($filters),
            'members' => $this->membersReport($filters),
        };

        $total = $rows->count();
        $truncated = false;
        if ($previewLimit !== null && $previewLimit > 0 && $total > $previewLimit) {
            $rows = $rows->take($previewLimit)->values();
            $truncated = true;
        }

        return [
            'type' => $type,
            'title' => self::TYPES[$type],
            'headings' => $headings,
            'rows' => $rows,
            'total' => $total,
            'truncated' => $truncated,
            'filters' => array_filter($filters, fn ($v) => $v !== null && $v !== ''),
        ];
    }

    /**
     * @param  array{county_code?:?string,constituency_code?:?string}  $filters
     * @return array{0:list<string>,1:Collection}
     */
    protected function constituenciesReport(array $filters): array
    {
        $rows = collect($this->analysisService->getApplicationsPerConstituency(array_filter([
            'county_code' => $filters['county_code'] ?? null,
            'constituency_code' => $filters['constituency_code'] ?? null,
        ])))->map(fn ($row, $i) => [
            $i + 1,
            $row->constituency_code,
            $row->constituency_name,
            $row->county_name,
            $row->portal_applications,
            $row->historical_records,
            $row->application_count,
        ]);

        return [
            ['#', 'Code', 'Constituency', 'County', 'Portal', 'Historical', 'Total'],
            $rows,
        ];
    }

    /**
     * @return array{0:list<string>,1:Collection}
     */
    protected function phasesReport(array $filters): array
    {
        $query = DB::table('loan_phases as lp')
            ->join('constituencies as c', 'lp.constituency_code', '=', 'c.constituency_code')
            ->join('counties as co', 'c.county_code', '=', 'co.county_code')
            ->leftJoin('group_loans as gl', function ($join) {
                $join->on('gl.loan_phase_id', '=', 'lp.id')
                    ->where('gl.loan_status', '=', 'financed');
            })
            ->when(! empty($filters['county_code']), fn ($q) => $q->where('c.county_code', $filters['county_code']))
            ->when(! empty($filters['constituency_code']), fn ($q) => $q->where('lp.constituency_code', $filters['constituency_code']))
            ->when(! empty($filters['phase_id']), fn ($q) => $q->where('lp.id', $filters['phase_id']))
            ->select(
                'lp.id',
                'lp.phase',
                'lp.status',
                'lp.constituency_code',
                'c.constituency_name',
                'co.county_name',
                DB::raw('COUNT(gl.id) as financed_groups'),
                DB::raw('COALESCE(SUM(gl.amount_issued), 0) as amount_issued'),
                DB::raw('COALESCE(SUM(gl.amount_repaid), 0) as amount_repaid')
            )
            ->groupBy(
                'lp.id',
                'lp.phase',
                'lp.status',
                'lp.constituency_code',
                'c.constituency_name',
                'co.county_name'
            )
            ->orderBy('co.county_name')
            ->orderBy('c.constituency_name')
            ->orderBy('lp.phase');

        $rows = $query->get()->values()->map(fn ($row, $i) => [
            $i + 1,
            $row->county_name,
            $row->constituency_name,
            $row->constituency_code,
            $row->phase,
            $row->status,
            (int) $row->financed_groups,
            (float) $row->amount_issued,
            (float) $row->amount_repaid,
        ]);

        return [
            ['#', 'County', 'Constituency', 'Code', 'Phase', 'Status', 'Financed groups', 'Amount issued', 'Amount repaid'],
            $rows,
        ];
    }

    /**
     * @return array{0:list<string>,1:Collection}
     */
    protected function groupsReport(array $filters): array
    {
        if (empty($filters['phase_id']) && empty($filters['constituency_code'])) {
            throw new \InvalidArgumentException('Select a constituency or phase for the groups report.');
        }

        $query = DB::table('group_loans as gl')
            ->join('loan_phases as lp', 'gl.loan_phase_id', '=', 'lp.id')
            ->join('constituencies as c', 'lp.constituency_code', '=', 'c.constituency_code')
            ->join('counties as co', 'c.county_code', '=', 'co.county_code')
            ->leftJoin('groups as g', 'gl.group_id', '=', 'g.id')
            ->leftJoin('wards as w', 'g.ward_id', '=', 'w.id')
            ->where('gl.loan_status', 'financed')
            ->when(! empty($filters['county_code']), fn ($q) => $q->where('c.county_code', $filters['county_code']))
            ->when(! empty($filters['constituency_code']), fn ($q) => $q->where('lp.constituency_code', $filters['constituency_code']))
            ->when(! empty($filters['phase_id']), fn ($q) => $q->where('lp.id', $filters['phase_id']))
            ->when(! empty($filters['group_loan_id']), fn ($q) => $q->where('gl.id', $filters['group_loan_id']))
            ->select(
                'gl.id',
                'co.county_name',
                'c.constituency_name',
                'lp.phase',
                'g.name as group_name',
                'g.reg_number',
                'w.ward_name',
                'gl.sector',
                'gl.category',
                'gl.amount_issued',
                'gl.amount_repaid',
                'gl.disbursement_date',
                DB::raw('(SELECT COUNT(*) FROM group_members gm WHERE gm.group_loans_id = gl.id) as member_count')
            )
            ->orderBy('co.county_name')
            ->orderBy('c.constituency_name')
            ->orderBy('lp.phase')
            ->orderBy('g.name');

        $rows = $query->get()->values()->map(fn ($row, $i) => [
            $i + 1,
            $row->county_name,
            $row->constituency_name,
            $row->phase,
            $row->group_name ?: '—',
            $row->reg_number ?: '—',
            $row->ward_name ?: '—',
            $row->sector ?: '—',
            $row->category ?: '—',
            (int) $row->member_count,
            (float) $row->amount_issued,
            (float) $row->amount_repaid,
            $row->disbursement_date ?: '—',
            (int) $row->id,
        ]);

        return [
            ['#', 'County', 'Constituency', 'Phase', 'Group', 'Reg no', 'Ward', 'Sector', 'Category', 'Members', 'Issued', 'Repaid', 'Disbursed', 'Loan ID'],
            $rows,
        ];
    }

    /**
     * @return array{0:list<string>,1:Collection}
     */
    protected function membersReport(array $filters): array
    {
        if (
            empty($filters['phase_id'])
            && empty($filters['constituency_code'])
            && empty($filters['group_loan_id'])
        ) {
            throw new \InvalidArgumentException('Select a constituency, phase, or group loan for the members report.');
        }

        $query = DB::table('group_members as gm')
            ->join('members as m', 'gm.member_Id', '=', 'm.member_Id')
            ->join('group_loans as gl', 'gm.group_loans_id', '=', 'gl.id')
            ->join('loan_phases as lp', 'gl.loan_phase_id', '=', 'lp.id')
            ->join('constituencies as c', 'lp.constituency_code', '=', 'c.constituency_code')
            ->join('counties as co', 'c.county_code', '=', 'co.county_code')
            ->leftJoin('groups as g', 'gl.group_id', '=', 'g.id')
            ->where('gl.loan_status', 'financed')
            ->when(! empty($filters['county_code']), fn ($q) => $q->where('c.county_code', $filters['county_code']))
            ->when(! empty($filters['constituency_code']), fn ($q) => $q->where('lp.constituency_code', $filters['constituency_code']))
            ->when(! empty($filters['phase_id']), fn ($q) => $q->where('lp.id', $filters['phase_id']))
            ->when(! empty($filters['group_loan_id']), fn ($q) => $q->where('gl.id', $filters['group_loan_id']))
            ->select(
                'co.county_name',
                'c.constituency_name',
                'lp.phase',
                'g.name as group_name',
                'g.reg_number',
                'gl.id as group_loan_id',
                'm.name as member_name',
                'm.member_Id',
                'm.number',
                'm.gender',
                'm.disabled',
                'gm.role'
            )
            ->orderBy('co.county_name')
            ->orderBy('c.constituency_name')
            ->orderBy('lp.phase')
            ->orderBy('g.name')
            ->orderBy('m.name');

        $rows = $query->get()->values()->map(fn ($row, $i) => [
            $i + 1,
            $row->county_name,
            $row->constituency_name,
            $row->phase,
            $row->group_name ?: '—',
            $row->reg_number ?: '—',
            (int) $row->group_loan_id,
            $row->member_name ?: '—',
            $row->member_Id,
            $row->number ?: '—',
            $row->gender ?: '—',
            $row->role ?: 'Member',
            ((int) $row->disabled) ? 'Yes' : 'No',
        ]);

        return [
            ['#', 'County', 'Constituency', 'Phase', 'Group', 'Reg no', 'Loan ID', 'Member', 'Member ID', 'Phone', 'Gender', 'Role', 'PWD'],
            $rows,
        ];
    }

    public function counties(): Collection
    {
        return DB::table('counties')
            ->orderBy('county_name')
            ->get(['county_code', 'county_name']);
    }

    public function constituencies(?string $countyCode = null): Collection
    {
        return DB::table('constituencies')
            ->when($countyCode, fn ($q) => $q->where('county_code', $countyCode))
            ->orderBy('constituency_name')
            ->get(['constituency_code', 'constituency_name', 'county_code']);
    }

    public function phases(?string $constituencyCode = null): Collection
    {
        return DB::table('loan_phases')
            ->when($constituencyCode, fn ($q) => $q->where('constituency_code', $constituencyCode))
            ->orderBy('phase')
            ->get(['id', 'phase', 'status', 'constituency_code']);
    }
}
