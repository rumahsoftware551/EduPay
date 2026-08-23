<?php
declare(strict_types=1);

// Compatibility proxy: public API v1 still dispatches here, while the
// production implementation lives in V5.5.2 with schema diagnostics.
$uri=(string)($_SERVER['REQUEST_URI']??'/api/v551/portal/state');
$_SERVER['REQUEST_URI']=str_replace('/api/v551/','/api/v552/',$uri);
require __DIR__.'/v552.php';
