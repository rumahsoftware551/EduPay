<?php
return [
    'db' => [
        'dsn' => 'pgsql:host=127.0.0.1;port=5432;dbname=edupay',
        'user' => 'edupay',
        'password' => 'CHANGE_ME',
    ],
    'app' => [
        'base_url' => 'https://edupay.rumahsoftware.site',
        'cookie_name' => 'edupay_session',
        'session_ttl' => 43200,
        'school_code' => 'default-school',
        'school_name' => 'Sekolah Demo EduPay',
    ],
];
