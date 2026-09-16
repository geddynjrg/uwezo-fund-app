<?php

namespace App\Services\Reports;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\Process\Process;

class LibreOfficeDocumentConverter
{
    public function isAvailable(): bool
    {
        return $this->binary() !== null;
    }

    public function binary(): ?string
    {
        foreach (['/usr/bin/libreoffice', '/usr/bin/soffice', 'libreoffice', 'soffice'] as $candidate) {
            if (str_starts_with($candidate, '/')) {
                if (is_executable($candidate)) {
                    return $candidate;
                }
                continue;
            }

            $which = trim((string) shell_exec('command -v '.escapeshellarg($candidate).' 2>/dev/null'));
            if ($which !== '' && is_executable($which)) {
                return $which;
            }
        }

        return null;
    }

    /**
     * Convert a spreadsheet to PDF using LibreOffice headless.
     *
     * @return string Absolute path to the generated PDF
     */
    public function toPdf(string $sourceAbsolutePath, ?string $outputDirectory = null): string
    {
        return $this->convert($sourceAbsolutePath, 'pdf', $outputDirectory);
    }

    /**
     * Convert a spreadsheet to HTML using LibreOffice headless.
     *
     * @return string Absolute path to the generated HTML
     */
    public function toHtml(string $sourceAbsolutePath, ?string $outputDirectory = null): string
    {
        return $this->convert($sourceAbsolutePath, 'html', $outputDirectory);
    }

    protected function convert(string $sourceAbsolutePath, string $format, ?string $outputDirectory = null): string
    {
        $binary = $this->binary();
        if ($binary === null) {
            throw new RuntimeException('LibreOffice is not installed. Install libreoffice-calc-nogui to enable PDF/HTML preview.');
        }

        if (! is_file($sourceAbsolutePath)) {
            throw new RuntimeException('Source file not found for LibreOffice conversion.');
        }

        $outputDirectory = $outputDirectory ?: dirname($sourceAbsolutePath);
        File::ensureDirectoryExists($outputDirectory);

        $userProfile = storage_path('app/reports/libreoffice-profile/'.Str::uuid());
        File::ensureDirectoryExists($userProfile);

        $process = new Process([
            $binary,
            '--headless',
            '--nologo',
            '--nolockcheck',
            '--nodefault',
            '--nofirststartwizard',
            '-env:UserInstallation=file://'.$userProfile,
            '--convert-to',
            $format,
            '--outdir',
            $outputDirectory,
            $sourceAbsolutePath,
        ], null, [
            'HOME' => $userProfile,
            'SAL_USE_VCLPLUGIN' => 'svp',
        ]);
        $process->setTimeout(120);
        $process->run();

        File::deleteDirectory($userProfile);

        if (! $process->isSuccessful()) {
            Log::error('LibreOffice conversion failed', [
                'output' => $process->getErrorOutput() ?: $process->getOutput(),
                'source' => $sourceAbsolutePath,
            ]);
            throw new RuntimeException('LibreOffice failed to convert the report. '.$process->getErrorOutput());
        }

        $expected = $outputDirectory.'/'.pathinfo($sourceAbsolutePath, PATHINFO_FILENAME).'.'.$format;
        if (! is_file($expected)) {
            throw new RuntimeException('LibreOffice conversion finished but output file was not created.');
        }

        return $expected;
    }
}
