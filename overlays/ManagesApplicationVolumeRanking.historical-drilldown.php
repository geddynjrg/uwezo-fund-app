<?php

namespace App\Livewire\Concerns;

use Livewire\Attributes\Computed;

trait ManagesApplicationVolumeRanking
{
    public string $applicationVolumeSearch = '';

    public ?string $applicationVolumeDetailCode = null;

    public ?int $applicationVolumeDetailPhaseId = null;

    public ?int $applicationVolumeDetailGroupLoanId = null;

    public string $applicationVolumeDetailSearch = '';

    public int $applicationVolumeDetailPage = 1;

    /**
     * @return array{county_code?: string, constituency_code?: string}
     */
    protected function applicationVolumeFilters(): array
    {
        return [];
    }

    public function openApplicationVolumeConstituency(string $constituencyCode): void
    {
        $code = trim($constituencyCode);
        if ($code === '') {
            return;
        }

        $this->applicationVolumeDetailCode = $code;
        $this->applicationVolumeDetailPhaseId = null;
        $this->applicationVolumeDetailGroupLoanId = null;
        $this->applicationVolumeDetailSearch = '';
        $this->applicationVolumeDetailPage = 1;
        $this->forgetApplicationVolumeDetailComputed();
    }

    public function closeApplicationVolumeConstituency(): void
    {
        $this->applicationVolumeDetailCode = null;
        $this->applicationVolumeDetailPhaseId = null;
        $this->applicationVolumeDetailGroupLoanId = null;
        $this->applicationVolumeDetailSearch = '';
        $this->applicationVolumeDetailPage = 1;
        $this->forgetApplicationVolumeDetailComputed();
    }

    public function openApplicationVolumePhase(int $phaseId): void
    {
        if ($phaseId <= 0) {
            return;
        }

        $this->applicationVolumeDetailPhaseId = $phaseId;
        $this->applicationVolumeDetailGroupLoanId = null;
        $this->applicationVolumeDetailSearch = '';
        $this->applicationVolumeDetailPage = 1;
        $this->forgetApplicationVolumeDetailComputed();
    }

    public function backApplicationVolumeToPhases(): void
    {
        $this->applicationVolumeDetailPhaseId = null;
        $this->applicationVolumeDetailGroupLoanId = null;
        $this->applicationVolumeDetailSearch = '';
        $this->applicationVolumeDetailPage = 1;
        $this->forgetApplicationVolumeDetailComputed();
    }

    public function openApplicationVolumeGroup(int $groupLoanId): void
    {
        if ($groupLoanId <= 0) {
            return;
        }

        $this->applicationVolumeDetailGroupLoanId = $groupLoanId;
        $this->forgetApplicationVolumeDetailComputed();
    }

    public function backApplicationVolumeToGroups(): void
    {
        $this->applicationVolumeDetailGroupLoanId = null;
        $this->forgetApplicationVolumeDetailComputed();
    }

    public function setApplicationVolumeDetailPage(int $page): void
    {
        $this->applicationVolumeDetailPage = max(1, $page);
        unset($this->applicationVolumePhaseGroups);
    }

    public function updatedApplicationVolumeDetailSearch(): void
    {
        $this->applicationVolumeDetailPage = 1;
        unset($this->applicationVolumePhaseGroups);
    }

    protected function forgetApplicationVolumeDetailComputed(): void
    {
        unset(
            $this->applicationVolumeConstituencyOverview,
            $this->applicationVolumePhaseGroups,
            $this->applicationVolumeGroupDetail
        );
    }

    #[Computed]
    public function applicationVolumeRows(): array
    {
        $rows = $this->analysisService->getApplicationsPerConstituency($this->applicationVolumeFilters());

        foreach ($rows as $index => $row) {
            $row->rank = $index + 1;
        }

        return $rows;
    }

    #[Computed]
    public function filteredApplicationVolumeRows(): array
    {
        $rows = collect($this->applicationVolumeRows);
        $search = trim(strtolower($this->applicationVolumeSearch));

        if ($search === '') {
            return $rows->all();
        }

        return $rows
            ->filter(function ($row) use ($search) {
                return str_contains(strtolower($row->constituency_name), $search)
                    || str_contains(strtolower($row->county_name ?? ''), $search);
            })
            ->values()
            ->all();
    }

    #[Computed]
    public function applicationVolumeStats(): array
    {
        $rows = collect($this->applicationVolumeRows);
        $top = $rows->first();

        return [
            'total' => (int) $rows->sum('application_count'),
            'constituency_count' => $rows->count(),
            'active_constituencies' => (int) $rows->where('application_count', '>', 0)->count(),
            'top_name' => $top?->constituency_name,
            'top_count' => (int) ($top?->application_count ?? 0),
            'max_count' => max((int) ($top?->application_count ?? 0), 1),
        ];
    }

    #[Computed]
    public function applicationVolumeConstituencyOverview(): ?array
    {
        if (! $this->applicationVolumeDetailCode) {
            return null;
        }

        return $this->analysisService->getHistoricalConstituencyOverview($this->applicationVolumeDetailCode);
    }

    #[Computed]
    public function applicationVolumePhaseGroups(): ?array
    {
        if (! $this->applicationVolumeDetailPhaseId) {
            return null;
        }

        return $this->analysisService->getHistoricalPhaseGroups(
            $this->applicationVolumeDetailPhaseId,
            $this->applicationVolumeDetailPage,
            25,
            $this->applicationVolumeDetailSearch !== '' ? $this->applicationVolumeDetailSearch : null
        );
    }

    #[Computed]
    public function applicationVolumeGroupDetail(): ?array
    {
        if (! $this->applicationVolumeDetailGroupLoanId) {
            return null;
        }

        return $this->analysisService->getHistoricalGroupDetail($this->applicationVolumeDetailGroupLoanId);
    }
}
