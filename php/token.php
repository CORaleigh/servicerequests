<?php
// Cityworks credentials — stored server-side only, never sent to the browser.
// Set these as environment variables on the server (preferred) or edit directly here.
$loginName = getenv('CW_USERNAME') ?: '<put your username here>';
$password  = getenv('CW_PASSWORD') ?: '<put your password here>';
$authUrl   = 'https://cityworks.raleighnc.gov/admin/Services/General/Authentication/Authenticate';

$payload = 'data=' . urlencode(json_encode([
    'LoginName' => $loginName,
    'Password'  => $password,
]));

$context = stream_context_create([
    'http' => [
        'method'  => 'POST',
        'header'  => "Content-Type: application/x-www-form-urlencoded\r\n",
        'content' => $payload,
    ],
]);

$response = file_get_contents($authUrl, false, $context);

if ($response === false) {
    http_response_code(502);
    echo json_encode(['error' => 'Unable to reach Cityworks authentication service']);
    exit;
}

header('Content-Type: application/json');
echo $response;
