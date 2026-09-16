<?php

namespace App\Services\Reports;

use App\Exports\ApplicationVolumeReportExport;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Facades\Excel;

class ApplicationVolumePreviewService
{
    public function __construct(
        protected ApplicationVolumeReportService $reports,
        protected LibreOfficeDocumentConverter $converter
    ) {
    }

    /**
     * Build Excel then convert with LibreOffice for on-screen preview.
     *
     * @param  array<string, mixed>  $params
     * @return array{token:string,type:string,title:string,total:int,xlsx_relative:string,pdf_relative:string,html_relative:?string}
     */
    public function buildLibreOfficePreview(array $params, bool $alsoHtml = false): array
    {
        $result = $this->reports->build(array_merge($params, ['preview_limit' => null]));
        $token = (string) Str::uuid();
        $dir = storage_path('app/reports/previews');
        File::ensureDirectoryExists($dir);

        $xlsxRelative = 'reports/previews/'.$token.'.xlsx';
        Excel::store(
            new ApplicationVolumeReportExport($result['headings'], $result['rows'], $result['title']),
            $xlsxRelative
        );

        $xlsxAbsolute = storage_path('app/'.$xlsxRelative);
        $pdfAbsolute = $this->converter->toPdf($xlsxAbsolute, $dir);
        $pdfRelative = 'reports/previews/'.basename($pdfAbsolute);

        $htmlRelative = null;
        if ($alsoHtml) {
            $htmlAbsolute = $this->converter->toHtml($xlsxAbsolute, $dir);
            $htmlRelative = 'reports/previews/'.basename($htmlAbsolute);
        }

        return [
            'token' => $token,
            'type' => $result['type'],
            'title' => $result['title'],
            'total' => $result['total'],
            'xlsx_relative' => $xlsxRelative,
            'pdf_relative' => $pdfRelative,
            'html_relative' => $htmlRelative,
        ];
    }
}
