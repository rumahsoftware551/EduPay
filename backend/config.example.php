<?php
return [
    'db' => [
        'dsn' => 'pgsql:host=127.0.0.1;port=5432;dbname=edupay_school',
        'user' => 'edupay_school',
        'password' => 'CHANGE_TO_RANDOM_DATABASE_PASSWORD',
    ],
    'app' => [
        'base_url' => 'https://bayar.sekolah.sch.id',
        'cookie_name' => 'edupay_session',
        'session_ttl' => 43200,
        'school_code' => 'sekolah-utama',
        'school_name' => 'Nama Sekolah',
        'bootstrap_key' => 'CHANGE_TO_RANDOM_BOOTSTRAP_KEY',
    ],
];
