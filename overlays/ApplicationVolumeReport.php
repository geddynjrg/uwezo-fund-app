<?php

namespace App\Livewire\Hq;

use App\Exports\ApplicationVolumeReportExport;
use App\Livewire\Concerns\ManagesApplicationVolumeRanking;
use App\Services\Loan\LoanAnalysisService;
use App\Services\Reports\ApplicationVolumeReportService;
use Livewire\Component;
use Maatwebsite\Excel\Facades\Excel;

class ApplicationVolumeReport extends Component
{
    use ManagesApplicationVolumeRanking;

    public string $reportType = 'constituencies';

    public string $countyFilter = '';

    public string $constituencyFilter = '';

    public string $phaseFilter = '';

    public string $groupLoanFilter = '';

    public bool $hasPreview = false;

    public string $previewError = '';

    public string $previewTitle = '';

    /** @var list<string> */
    public array $previewHeadings = [];

    /** @var list<list<mixed>> */
    public array $previewRows = [];

    public int $previewTotal = 0;

    public bool $previewTruncated = false;

    public string $scopeConstituencyCode = '';

    public string $pageTitle = 'Applications by constituency';

    protected LoanAnalysisService $analysisService;

    protected ApplicationVolumeReportService $reportService;

    public function boot(
        LoanAnalysisService $analysisService,
        ApplicationVolumeReportService $reportService
    ): void {
        $this->analysisService = $analysisService;
        $this->reportService = $reportService;
    }

    public function mount(?string $constituencyCode = null): void
    {
        if ($constituencyCode) {
            $this->scopeConstituencyCode = $constituencyCode;
            $this->constituencyFilter = $constituencyCode;
            $this->pageTitle = 'Constituency application volume';
        }
    }

    protected function applicationVolumeFilters(): array
    {
        $filters = [];
        if ($this->scopeConstituencyCode !== '') {
            $filters['constituency_code'] = $this->scopeConstituencyCode;
        } elseif ($this->countyFilter !== '') {
            $filters['county_code'] = $this->countyFilter;
        }
        if ($this->constituencyFilter !== '' && $this->scopeConstituencyCode === '') {
            // ranking can stay national unless scoped; county filter only for ranking via countyFilter
        }

        return $filters;
    }

    public function updatedCountyFilter(): void
    {
        $this->constituencyFilter = '';
        $this->phaseFilter = '';
        $this->clearPreview();
        unset($this->applicationVolumeRows, $this->filteredApplicationVolumeRows, $this->applicationVolumeStats);
    }

    public function updatedConstituencyFilter(): void
    {
        $this->phaseFilter = '';
        $this->clearPreview();
    }

    public function updatedReportType(): void
    {
        $this->clearPreview();
    }

    public function updatedApplicationVolumeSearch(): void
    {
        unset($this->filteredApplicationVolumeRows);
    }

    public function previewReport(): void
    {
        $this->previewError = '';
        try {
            $result = $this->reportService->build($this->reportParams(250));
            $this->hasPreview = true;
            $this->previewTitle = $result['title'];
            $this->previewHeadings = $result['headings'];
            $this->previewRows = $result['rows']->map(fn ($row) => array_values($row))->all();
            $this->previewTotal = $result['total'];
            $this->previewTruncated = $result['truncated'];
        } catch (\Throwable $e) {
            $this->clearPreview();
            $this->previewError = $e->getMessage();
        }
    }

    public function downloadReport()
    {
        $this->previewError = '';
        try {
            $result = $this->reportService->build($this->reportParams(null));
        } catch (\Throwable $e) {
            $this->previewError = $e->getMessage();

            return null;
        }

        $slug = str_replace('_', '-', $result['type']);
        $filename = 'application-volume-'.$slug.'-'.now()->format('Ymd-His').'.xlsx';

        return Excel::download(
            new ApplicationVolumeReportExport($result['headings'], $result['rows'], $result['title']),
            $filename
        );
    }

    /**
     * @return array<string, mixed>
     */
    protected function reportParams(?int $previewLimit): array
    {
        $params = [
            'type' => $this->reportType,
            'preview_limit' => $previewLimit,
        ];

        if ($this->scopeConstituencyCode !== '') {
            $params['constituency_code'] = $this->scopeConstituencyCode;
        } else {
            if ($this->countyFilter !== '') {
                $params['county_code'] = $this->countyFilter;
            }
            if ($this->constituencyFilter !== '') {
                $params['constituency_code'] = $this->constituencyFilter;
            }
        }

        if ($this->phaseFilter !== '') {
            $params['phase_id'] = $this->phaseFilter;
        }
        if ($this->groupLoanFilter !== '') {
            $params['group_loan_id'] = $this->groupLoanFilter;
        }

        return $params;
    }

    protected function clearPreview(): void
    {
        $this->hasPreview = false;
        $this->previewTitle = '';
        $this->previewHeadings = [];
        $this->previewRows = [];
        $this->previewTotal = 0;
        $this->previewTruncated = false;
    }

    public function render()
    {
        $counties = $this->reportService->counties();
        $constituencies = $this->reportService->constituencies(
            $this->scopeConstituencyCode !== ''
                ? null
                : ($this->countyFilter !== '' ? $this->countyFilter : null)
        );
        if ($this->scopeConstituencyCode !== '') {
            $constituencies = $constituencies->where('constituency_code', $this->scopeConstituencyCode)->values();
        }

        $phases = $this->reportService->phases(
            $this->scopeConstituencyCode !== ''
                ? $this->scopeConstituencyCode
                : ($this->constituencyFilter !== '' ? $this->constituencyFilter : null)
        );

        return view('livewire.hq.application-volume-report', [
            'reportTypes' => ApplicationVolumeReportService::TYPES,
            'counties' => $counties,
            'constituencies' => $constituencies,
            'phases' => $phases,
        ]);
    }
}
