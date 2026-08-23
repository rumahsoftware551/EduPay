<?php
declare(strict_types=1);

$configFile = __DIR__ . '/config.php';
if (!file_exists($configFile)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'message' => 'Backend belum dikonfigurasi.']);
    exit;
}
$config = require $configFile;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

session_name($config['app']['cookie_name'] ?? 'edupay_session');
session_set_cookie_params([
    'lifetime' => (int)($config['app']['session_ttl'] ?? 43200),
    'path' => '/',
    'secure' => true,
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

function jsonInput(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '{}', true);
    return is_array($data) ? $data : [];
}
function respond(int $status, array $payload): never {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function normalizePhone(string $value): string {
    $s = preg_replace('/[\s()\-]/', '', trim($value));
    if (str_starts_with($s, '+62')) $s = '0' . substr($s, 3);
    elseif (str_starts_with($s, '62')) $s = '0' . substr($s, 2);
    return $s;
}
function validPassword(string $p): bool {
    return strlen($p) >= 8 && preg_match('/[a-z]/', $p) && preg_match('/[A-Z]/', $p) && preg_match('/\d/', $p);
}
function db(array $config): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $pdo = new PDO($config['db']['dsn'], $config['db']['user'], $config['db']['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    return $pdo;
}
function currentSchoolId(PDO $pdo, array $config): int {
    $code = $config['app']['school_code'] ?? 'default-school';
    $name = $config['app']['school_name'] ?? 'Sekolah EduPay';
    $stmt = $pdo->prepare('SELECT id FROM schools WHERE code = ?');
    $stmt->execute([$code]);
    $id = $stmt->fetchColumn();
    if ($id) return (int)$id;
    $stmt = $pdo->prepare('INSERT INTO schools(code,name) VALUES(?,?) RETURNING id');
    $stmt->execute([$code,$name]);
    return (int)$stmt->fetchColumn();
}
function audit(PDO $pdo, ?int $schoolId, ?int $userId, string $action, ?string $entityType = null, ?string $entityId = null, array $metadata = []): void {
    $ip = $_SERVER['REMOTE_ADDR'] ?? null;
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? null;
    $stmt = $pdo->prepare('INSERT INTO audit_logs(school_id,user_id,action,entity_type,entity_id,ip_address,user_agent,metadata) VALUES(?,?,?,?,?,?,?,?::jsonb)');
    $stmt->execute([$schoolId,$userId,$action,$entityType,$entityId,$ip,$ua,json_encode($metadata, JSON_UNESCAPED_UNICODE)]);
}
function requireUser(array $roles = []): array {
    if (empty($_SESSION['user'])) respond(401, ['ok'=>false,'message'=>'Belum login']);
    $u = $_SESSION['user'];
    if ($roles && !in_array($u['role'], $roles, true)) respond(403, ['ok'=>false,'message'=>'Akses ditolak']);
    return $u;
}

$pdo = db($config);
$schoolId = currentSchoolId($pdo, $config);
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($path === '/api/health' && $method === 'GET') {
    respond(200, ['ok'=>true,'service'=>'EduPay API','db'=>'postgresql']);
}

if ($path === '/api/auth/me' && $method === 'GET') {
    respond(200, ['ok'=>true,'user'=>$_SESSION['user'] ?? null]);
}

if ($path === '/api/auth/login' && $method === 'POST') {
    $in = jsonInput();
    $username = trim((string)($in['username'] ?? ''));
    $password = (string)($in['password'] ?? '');
    $lookup = preg_match('/^(\+?62|0)\d+$/', $username) ? normalizePhone($username) : $username;
    $stmt = $pdo->prepare('SELECT * FROM users WHERE school_id=? AND username=? LIMIT 1');
    $stmt->execute([$schoolId,$lookup]);
    $u = $stmt->fetch();
    if (!$u) respond(401,['ok'=>false,'message'=>'Username atau password salah']);
    if ($u['status']==='disabled') respond(403,['ok'=>false,'message'=>'Akun dinonaktifkan']);
    if ($u['role']==='parent' && $u['status']!=='active') respond(403,['ok'=>false,'message'=>'Akun wali belum diaktivasi']);
    if ($u['locked_until'] && strtotime($u['locked_until']) > time()) respond(423,['ok'=>false,'message'=>'Akun sementara terkunci']);
    if (!$u['password_hash'] || !password_verify($password, $u['password_hash'])) {
        $attempts = (int)$u['failed_attempts'] + 1;
        if ($attempts >= 5) {
            $stmt = $pdo->prepare("UPDATE users SET failed_attempts=0, locked_until=NOW()+INTERVAL '15 minutes', updated_at=NOW() WHERE id=?");
            $stmt->execute([$u['id']]);
            audit($pdo,$schoolId,(int)$u['id'],'auth.lockout','user',(string)$u['id']);
            respond(423,['ok'=>false,'message'=>'Terlalu banyak percobaan. Akun dikunci 15 menit.']);
        }
        $stmt = $pdo->prepare('UPDATE users SET failed_attempts=?, updated_at=NOW() WHERE id=?');
        $stmt->execute([$attempts,$u['id']]);
        respond(401,['ok'=>false,'message'=>'Username atau password salah']);
    }
    $stmt = $pdo->prepare('UPDATE users SET failed_attempts=0,locked_until=NULL,last_login_at=NOW(),updated_at=NOW() WHERE id=?');
    $stmt->execute([$u['id']]);
    $studentIds = [];
    if ($u['role']==='parent') {
        $stmt = $pdo->prepare('SELECT student_id FROM guardian_students WHERE guardian_user_id=? ORDER BY student_id');
        $stmt->execute([$u['id']]);
        $studentIds = array_map('intval', array_column($stmt->fetchAll(), 'student_id'));
    }
    session_regenerate_id(true);
    $_SESSION['user'] = [
        'id'=>(int)$u['id'],'name'=>$u['name'],'username'=>$u['username'],'role'=>$u['role'],
        'studentIds'=>$studentIds,'studentId'=>$studentIds[0] ?? null
    ];
    audit($pdo,$schoolId,(int)$u['id'],'auth.login','user',(string)$u['id']);
    respond(200,['ok'=>true,'user'=>$_SESSION['user']]);
}

if ($path === '/api/auth/logout' && $method === 'POST') {
    $uid = isset($_SESSION['user']['id']) ? (int)$_SESSION['user']['id'] : null;
    audit($pdo,$schoolId,$uid,'auth.logout');
    $_SESSION = [];
    session_destroy();
    respond(200,['ok'=>true]);
}

if ($path === '/api/auth/activate' && $method === 'POST') {
    $in = jsonInput();
    $phone = normalizePhone((string)($in['username'] ?? ''));
    $code = preg_replace('/\D/','',(string)($in['code'] ?? ''));
    $password = (string)($in['password'] ?? '');
    if (!validPassword($password)) respond(422,['ok'=>false,'message'=>'Password minimal 8 karakter dan wajib berisi huruf besar, huruf kecil, serta angka.']);
    $stmt = $pdo->prepare("SELECT u.*,t.id token_id,t.token_hash,t.expires_at FROM users u JOIN activation_tokens t ON t.user_id=u.id WHERE u.school_id=? AND u.role='parent' AND u.username=? AND t.used_at IS NULL ORDER BY t.id DESC LIMIT 1");
    $stmt->execute([$schoolId,$phone]);
    $row = $stmt->fetch();
    if (!$row) respond(404,['ok'=>false,'message'=>'Belum ada undangan aktivasi yang aktif']);
    if (strtotime($row['expires_at']) < time()) respond(410,['ok'=>false,'message'=>'Kode aktivasi sudah kedaluwarsa']);
    if (!hash_equals($row['token_hash'], hash('sha256',$code))) respond(422,['ok'=>false,'message'=>'Kode aktivasi tidak sesuai']);
    $pdo->beginTransaction();
    try {
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("UPDATE users SET password_hash=?,status='active',activated_at=NOW(),failed_attempts=0,locked_until=NULL,updated_at=NOW() WHERE id=?");
        $stmt->execute([$hash,$row['id']]);
        $stmt = $pdo->prepare('UPDATE activation_tokens SET used_at=NOW() WHERE id=?');
        $stmt->execute([$row['token_id']]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack(); throw $e;
    }
    audit($pdo,$schoolId,(int)$row['id'],'guardian.activated','user',(string)$row['id']);
    respond(200,['ok'=>true,'message'=>'Akun berhasil diaktifkan']);
}

if ($path === '/api/admin/guardians/sync' && $method === 'POST') {
    $admin = requireUser(['admin']);
    $stmt = $pdo->prepare("SELECT guardian_phone,MAX(guardian_name) guardian_name FROM students WHERE school_id=? AND active=TRUE AND guardian_phone IS NOT NULL AND guardian_phone<>'' GROUP BY guardian_phone");
    $stmt->execute([$schoolId]);
    $rows=$stmt->fetchAll();
    $created=0;$linked=0;
    foreach($rows as $r){
        $phone=normalizePhone($r['guardian_phone']); if(!$phone) continue;
        $stmt=$pdo->prepare("SELECT id FROM users WHERE school_id=? AND role='parent' AND username=?");$stmt->execute([$schoolId,$phone]);$uid=$stmt->fetchColumn();
        if(!$uid){$stmt=$pdo->prepare("INSERT INTO users(school_id,name,username,role,status) VALUES(?,?,?,'parent','not_invited') RETURNING id");$stmt->execute([$schoolId,$r['guardian_name']?:'Wali Murid',$phone]);$uid=$stmt->fetchColumn();$created++;}
        $stmt=$pdo->prepare('SELECT id FROM students WHERE school_id=? AND active=TRUE AND guardian_phone=?');$stmt->execute([$schoolId,$r['guardian_phone']]);
        foreach($stmt->fetchAll() as $s){$ins=$pdo->prepare('INSERT INTO guardian_students(guardian_user_id,student_id) VALUES(?,?) ON CONFLICT DO NOTHING');$ins->execute([$uid,$s['id']]);$linked += $ins->rowCount();}
    }
    audit($pdo,$schoolId,(int)$admin['id'],'guardian.sync',null,null,['created'=>$created,'linked'=>$linked]);
    respond(200,['ok'=>true,'created'=>$created,'linked'=>$linked]);
}

if (preg_match('#^/api/admin/guardians/(\d+)/invite$#',$path,$m) && $method === 'POST') {
    $admin=requireUser(['admin']);$uid=(int)$m[1];
    $stmt=$pdo->prepare("SELECT * FROM users WHERE id=? AND school_id=? AND role='parent'");$stmt->execute([$uid,$schoolId]);$u=$stmt->fetch();
    if(!$u) respond(404,['ok'=>false,'message'=>'Akun wali tidak ditemukan']);
    $code=(string)random_int(100000,999999);$hash=hash('sha256',$code);
    $pdo->beginTransaction();
    try{
        $pdo->prepare('UPDATE activation_tokens SET used_at=NOW() WHERE user_id=? AND used_at IS NULL')->execute([$uid]);
        $pdo->prepare("INSERT INTO activation_tokens(school_id,user_id,token_hash,expires_at,created_by) VALUES(?,?,?,NOW()+INTERVAL '24 hours',?)")->execute([$schoolId,$uid,$hash,$admin['id']]);
        $pdo->prepare("UPDATE users SET status='invited',password_hash=NULL,updated_at=NOW() WHERE id=?")->execute([$uid]);
        $pdo->commit();
    }catch(Throwable $e){$pdo->rollBack();throw $e;}
    audit($pdo,$schoolId,(int)$admin['id'],'guardian.invite','user',(string)$uid);
    respond(200,['ok'=>true,'username'=>$u['username'],'name'=>$u['name'],'code'=>$code,'expires_hours'=>24]);
}

if ($path === '/api/admin/bootstrap' && $method === 'POST') {
    $in=jsonInput();$key=(string)($in['bootstrap_key']??'');
    $expected=(string)($config['app']['bootstrap_key']??'');
    if(!$expected || !hash_equals($expected,$key)) respond(403,['ok'=>false,'message'=>'Bootstrap key tidak valid']);
    $adminPassword=(string)($in['admin_password']??'');
    $financePassword=(string)($in['finance_password']??'');
    if(!validPassword($adminPassword)||!validPassword($financePassword)) respond(422,['ok'=>false,'message'=>'Password admin/finance harus memenuhi aturan keamanan']);
    $pdo->beginTransaction();
    try{
        $up=$pdo->prepare("INSERT INTO users(school_id,name,username,password_hash,role,status) VALUES(?,?,?,?,?,'active') ON CONFLICT(school_id,username) DO UPDATE SET name=EXCLUDED.name,password_hash=EXCLUDED.password_hash,role=EXCLUDED.role,status='active',updated_at=NOW()");
        $up->execute([$schoolId,'Administrator','admin',password_hash($adminPassword,PASSWORD_DEFAULT),'admin']);
        $up->execute([$schoolId,'Bendahara Sekolah','finance',password_hash($financePassword,PASSWORD_DEFAULT),'finance']);
        foreach(($in['classes']??[]) as $c){$st=$pdo->prepare("INSERT INTO classes(school_id,external_id,name,level,academic_year,active) VALUES(?,?,?,?,?,?) ON CONFLICT(school_id,name,academic_year) DO UPDATE SET level=EXCLUDED.level,active=EXCLUDED.active,updated_at=NOW()");$st->execute([$schoolId,(string)($c['id']??''),(string)$c['name'],(string)($c['level']??''),(string)($c['academicYear']??''),(bool)($c['active']??true)]);}
        foreach(($in['students']??[]) as $s){$cid=null;if(isset($s['className'])){$st=$pdo->prepare('SELECT id FROM classes WHERE school_id=? AND name=? ORDER BY id DESC LIMIT 1');$st->execute([$schoolId,$s['className']]);$cid=$st->fetchColumn()?:null;}$st=$pdo->prepare("INSERT INTO students(school_id,external_id,nis,name,class_id,guardian_name,guardian_phone,active) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(school_id,nis) DO UPDATE SET name=EXCLUDED.name,class_id=EXCLUDED.class_id,guardian_name=EXCLUDED.guardian_name,guardian_phone=EXCLUDED.guardian_phone,active=EXCLUDED.active,updated_at=NOW()");$st->execute([$schoolId,(string)($s['id']??''),(string)$s['nis'],(string)$s['name'],$cid,(string)($s['parent']??''),normalizePhone((string)($s['phone']??'')),(bool)($s['active']??true)]);}
        $pdo->commit();
    }catch(Throwable $e){$pdo->rollBack();throw $e;}
    respond(200,['ok'=>true,'message'=>'Bootstrap data inti selesai']);
}

respond(404,['ok'=>false,'message'=>'Endpoint tidak ditemukan']);
