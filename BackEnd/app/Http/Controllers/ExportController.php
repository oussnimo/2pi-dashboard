<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use ZipArchive;

class ExportController extends Controller
{
    public function exportQuizAsZip(Request $request)
    {
        try {
            \Log::info('📦 [Export] Starting SCORM export');

            $validated = $request->validate([
                'course'     => 'required|string',
                'topic'      => 'required|string',
                'gameNumber' => 'required|integer',
                'numLevels'  => 'required|integer',
                'levels'     => 'required|array',
            ]);

            $quizData    = $validated;
            $scormTitle  = "{$quizData['course']} - {$quizData['topic']}";
            $timestamp   = now()->format('Y-m-d_H-i-s');
            $zipFilename = "scorm_quiz_{$timestamp}.zip";
            $zipPath     = storage_path("app/temp/{$zipFilename}");

            $gamePath = storage_path("app/games/game_{$quizData['gameNumber']}");

            if (!file_exists($gamePath)) {
                return response()->json([
                    'success' => false,
                    'message' => "Dossier du jeu introuvable : {$gamePath}"
                ], 404);
            }

            if (!file_exists(storage_path('app/temp'))) {
                mkdir(storage_path('app/temp'), 0755, true);
            }

            $zip = new ZipArchive();
            if ($zip->open($zipPath, ZipArchive::CREATE) !== TRUE) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot create ZIP'
                ], 500);
            }

            $zip->addFromString('imsmanifest.xml', $this->getManifest($scormTitle));
            $zip->addFromString('scorm.js', $this->getScormJs());

            $indexHtmlPath = "{$gamePath}/index.html";
            if (!file_exists($indexHtmlPath)) {
                return response()->json([
                    'success' => false,
                    'message' => 'index.html introuvable dans le dossier du jeu'
                ], 404);
            }

            $htmlContent = file_get_contents($indexHtmlPath);
            if (strpos($htmlContent, 'scorm.js') === false) {
                $htmlContent = str_replace(
                    '<head>',
                    '<head>' . "\n    " . '<script src="scorm.js"></script>',
                    $htmlContent
                );
            }
            $zip->addFromString('index.html', $htmlContent);

            $gameFiles = [
                'index.js',
                'index.wasm',
                'index.pck',
                'index.png',
                'index.audio.worklet.js',
                'index.apple-touch-icon.png',
                'index.icon.png',
            ];

            foreach ($gameFiles as $filename) {
                $filePath = "{$gamePath}/{$filename}";
                if (file_exists($filePath)) {
                    $zip->addFile($filePath, $filename);
                } else {
                    \Log::warning("Fichier Godot manquant : {$filename}");
                }
            }

            $zip->addFromString('data/levels_data.json', json_encode([
                'title'  => $scormTitle,
                'levels' => $quizData['levels']
            ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

            $zip->close();

            \Log::info("Export SCORM ready: {$zipFilename}");

            return response()->download($zipPath, $zipFilename)
                             ->deleteFileAfterSend(true);

        } catch (\Exception $e) {
            \Log::error('Export error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to export quiz: ' . $e->getMessage()
            ], 500);
        }
    }

    private function getScormJs()
    {
        $js  = 'function scorm_initialize() {' . "\n";
        $js .= '    var api = window.API || window.parent.API;' . "\n";
        $js .= '    if (api) { api.LMSInitialize(""); return true; }' . "\n";
        $js .= '    return false;' . "\n";
        $js .= '}' . "\n\n";
        $js .= 'function scorm_set_score(score, min, max) {' . "\n";
        $js .= '    var api = window.API || window.parent.API;' . "\n";
        $js .= '    if (api) {' . "\n";
        $js .= '        api.LMSSetValue("cmi.core.score.raw", score);' . "\n";
        $js .= '        api.LMSSetValue("cmi.core.score.min", min);' . "\n";
        $js .= '        api.LMSSetValue("cmi.core.score.max", max);' . "\n";
        $js .= '        api.LMSCommit("");' . "\n";
        $js .= '    }' . "\n";
        $js .= '}' . "\n\n";
        $js .= 'function scorm_set_completion(passed) {' . "\n";
        $js .= '    var api = window.API || window.parent.API;' . "\n";
        $js .= '    if (api) {' . "\n";
        $js .= '        api.LMSSetValue("cmi.core.lesson_status", passed ? "passed" : "failed");' . "\n";
        $js .= '        api.LMSCommit("");' . "\n";
        $js .= '    }' . "\n";
        $js .= '}' . "\n\n";
        $js .= 'function scorm_finish() {' . "\n";
        $js .= '    var api = window.API || window.parent.API;' . "\n";
        $js .= '    if (api) { api.LMSFinish(""); }' . "\n";
        $js .= '}' . "\n\n";
        $js .= 'scorm_initialize();' . "\n";
        return $js;
    }

    private function getManifest($title)
    {
        $id = 'quiz_' . md5($title);
        $xml  = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<manifest identifier="' . $id . '" version="1.0"' . "\n";
        $xml .= '    xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"' . "\n";
        $xml .= '    xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"' . "\n";
        $xml .= '    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' . "\n";
        $xml .= '    <metadata>' . "\n";
        $xml .= '        <schema>ADL SCORM</schema>' . "\n";
        $xml .= '        <schemaversion>1.2</schemaversion>' . "\n";
        $xml .= '    </metadata>' . "\n";
        $xml .= '    <organizations default="org1">' . "\n";
        $xml .= '        <organization identifier="org1">' . "\n";
        $xml .= '            <title>' . $title . '</title>' . "\n";
        $xml .= '            <item identifier="item1" identifierref="resource1">' . "\n";
        $xml .= '                <title>' . $title . '</title>' . "\n";
        $xml .= '            </item>' . "\n";
        $xml .= '        </organization>' . "\n";
        $xml .= '    </organizations>' . "\n";
        $xml .= '    <resources>' . "\n";
        $xml .= '        <resource identifier="resource1"' . "\n";
        $xml .= '            type="webcontent"' . "\n";
        $xml .= '            adlcp:scormtype="sco"' . "\n";
        $xml .= '            href="index.html">' . "\n";
        $xml .= '            <file href="index.html"/>' . "\n";
        $xml .= '            <file href="scorm.js"/>' . "\n";
        $xml .= '            <file href="index.js"/>' . "\n";
        $xml .= '            <file href="index.wasm"/>' . "\n";
        $xml .= '            <file href="index.pck"/>' . "\n";
        $xml .= '            <file href="index.png"/>' . "\n";
        $xml .= '            <file href="data/levels_data.json"/>' . "\n";
        $xml .= '        </resource>' . "\n";
        $xml .= '    </resources>' . "\n";
        $xml .= '</manifest>' . "\n";
        return $xml;
    }
}
