<?php
declare(strict_types=1);

$configFile=__DIR__.'/config.php';
if(!file_exists($configFile)){http_response_code(500);header('Content-Type: application/json; charset=utf-8');echo json_encode(['ok'=>false,'message'=>'Backend belum dikonfigurasi']);exit;}
$config=require $configFile;
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
session_name($config['app']['cookie_name']??'edupay_session');
session_set_cookie_params(['lifetime'=>(int)($config['app']['session_ttl']??43200),'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
session_start();

function r55(int $status,array $data):never{http_response_code($status);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
function db55(array $c):PDO{return new PDO($c['db']['dsn'],$c['db']['user'],$c['db']['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);}
function school55(PDO $pdo,array $c):int{$code=$c['app']['school_code']??'default-school';$q=$pdo->prepare('SELECT id FROM schools WHERE code=?');$q->execute([$code]);$id=$q->fetchColumn();if(!$id)r55(500,['ok'=>false,'message'=>'Sekolah belum tersedia']);return(int)$id;}
function auth55(array $roles=[]):array{if(empty($_SESSION['user']))r55(401,['ok'=>false,'message'=>'Belum login']);$u=$_SESSION['user'];if($roles&&!in_array($u['role']??'',$roles,true))r55(403,['ok'=>false,'message'=>'Akses tidak diizinkan']);return$u;}
function qp55(string $key,string $default=''):string{return trim((string)($_GET[$key]??$default));}
function qi55(string $key,int $default=0):int{return (int)($_GET[$key]??$default);}
function page55():array{$page=max(1,qi55('page',1));$per=qi55('per_page',25);if(!in_array($per,[10,25,50,100],true))$per=25;return[$page,$per,($page-1)*$per];}
function validDate55(string $v):?string{if($v===''||!preg_match('/^\d{4}-\d{2}-\d{2}$/',$v))return null;[$y,$m,$d]=array_map('intval',explode('-',$v));return checkdate($m,$d,$y)?$v:null;}
function paged55(array $items,int $total,int $page,int $per):array{return ['items'=>$items,'pagination'=>['page'=>$page,'perPage'=>$per,'total'=>$total,'pages'=>max(1,(int)ceil($total/max(1,$per)))]];}
function prefix55(string $q):string{return mb_strtolower($q,'UTF-8').'%';}
function schoolRow55(PDO $pdo,int $schoolId):array{$q=$pdo->prepare('SELECT id,code,name,npsn,address,phone,email,principal_name,treasurer_name,bank_name,bank_account,bank_account_name,qris_info,academic_year_current,semester_current,support_email,app_name,logo_url,active,updated_at FROM schools WHERE id=?');$q->execute([$schoolId]);return$q->fetch()?:[];}
function classes55(PDO $pdo,int $schoolId):array{$q=$pdo->prepare('SELECT id,name,level,academic_year,active,homeroom_teacher_id FROM classes WHERE school_id=? ORDER BY active DESC,name,id');$q->execute([$schoolId]);$rows=[];foreach($q->fetchAll() as$r)$rows[]=['id'=>(int)$r['id'],'name'=>$r['name'],'level'=>$r['level']??'','academicYear'=>$r['academic_year']??'','active'=>(bool)$r['active'],'homeroomTeacherId'=>$r['homeroom_teacher_id']?(int)$r['homeroom_teacher_id']:null];return$rows;}
function teachers55(PDO $pdo,int $schoolId):array{$q=$pdo->prepare('SELECT id,nip,name,phone,email,active FROM homeroom_teachers WHERE school_id=? ORDER BY active DESC,name,id');$q->execute([$schoolId]);$rows=[];foreach($q->fetchAll() as$r)$rows[]=['id'=>(int)$r['id'],'nip'=>$r['nip']??'','name'=>$r['name'],'phone'=>$r['phone']??'','email'=>$r['email']??'','active'=>(bool)$r['active']];return$rows;}
function fees55(PDO $pdo,int $schoolId):array{$q=$pdo->prepare('SELECT id,name,amount,period,active FROM fee_types WHERE school_id=? ORDER BY active DESC,name,id');$q->execute([$schoolId]);$rows=[];foreach($q->fetchAll() as$r)$rows[]=['id'=>(int)$r['id'],'name'=>$r['name'],'amount'=>(float)$r['amount'],'period'=>$r['period']??'','active'=>(bool)$r['active']];return$rows;}

function studentWhere55(int $schoolId,array &$params):string{
  $where=['s.school_id=?'];$params[]=$schoolId;
  $q=qp55('q');if($q!==''){$p=prefix55($q);$where[]='(LOWER(s.name) LIKE ? OR LOWER(s.nis) LIKE ? OR LOWER(COALESCE(s.guardian_name,\'\')) LIKE ? OR COALESCE(s.guardian_phone,\'\') LIKE ?)';array_push($params,$p,$p,$p,$q.'%');}
  $classId=qi55('class_id');if($classId>0){$where[]='s.class_id=?';$params[]=$classId;}
  $status=qp55('status','all');if($status==='active')$where[]='s.active=TRUE';elseif($status==='inactive')$where[]='s.active=FALSE';
  return implode(' AND ',$where);
}
function billWhere55(int $schoolId,array &$params,bool $arrearsOnly=false):string{
  $where=['b.school_id=?'];$params[]=$schoolId;
  if($arrearsOnly)$where[]="b.status IN ('unpaid','pending')";
  else{$status=qp55('status','all');if(in_array($status,['unpaid','pending','paid','cancelled'],true)){$where[]='b.status=?';$params[]=$status;}}
  $q=qp55('q');if($q!==''){$p=prefix55($q);$where[]='(LOWER(s.name) LIKE ? OR LOWER(s.nis) LIKE ? OR LOWER(b.title) LIKE ? OR LOWER(COALESCE(s.guardian_name,\'\')) LIKE ?)';array_push($params,$p,$p,$p,$p);}
  $classId=qi55('class_id');if($classId>0){$where[]='s.class_id=?';$params[]=$classId;}
  $from=validDate55(qp55('due_from'));if($from){$where[]='b.due_date>=?';$params[]=$from;}
  $to=validDate55(qp55('due_to'));if($to){$where[]='b.due_date<=?';$params[]=$to;}
  if(qp55('overdue')==='1')$where[]='b.due_date<CURRENT_DATE';
  return implode(' AND ',$where);
}
function paymentWhere55(int $schoolId,array &$params):string{
  $where=['p.school_id=?'];$params[]=$schoolId;
  $q=qp55('q');if($q!==''){$pfx=prefix55($q);$where[]='(LOWER(p.receipt) LIKE ? OR LOWER(s.name) LIKE ? OR LOWER(s.nis) LIKE ? OR LOWER(b.title) LIKE ?)';array_push($params,$pfx,$pfx,$pfx,$pfx);}
  $classId=qi55('class_id');if($classId>0){$where[]='s.class_id=?';$params[]=$classId;}
  $method=qp55('method','all');if(in_array($method,['Cash','Transfer','QRIS'],true)){$where[]='p.method=?';$params[]=$method;}
  $status=qp55('status','valid');if($status==='valid')$where[]='p.voided=FALSE';elseif($status==='void')$where[]='p.voided=TRUE';
  $from=validDate55(qp55('date_from'));if($from){$where[]='p.paid_at>=?::date';$params[]=$from;}
  $to=validDate55(qp55('date_to'));if($to){$where[]='p.paid_at<?::date + INTERVAL \'1 day\'';$params[]=$to;}
  return implode(' AND ',$where);
}

function exportRows55(PDO $pdo,int $schoolId,string $type):array{
  if($type==='payments'){
    $params=[];$where=paymentWhere55($schoolId,$params);
    $sql="SELECT p.receipt,p.paid_at,s.nis,s.name student_name,c.name class_name,b.title,p.amount,p.method,p.voided,u.name verified_by,p.void_reason
      FROM payments p JOIN students s ON s.id=p.student_id LEFT JOIN classes c ON c.id=s.class_id JOIN bills b ON b.id=p.bill_id LEFT JOIN users u ON u.id=p.verified_by
      WHERE $where ORDER BY p.paid_at DESC,p.id DESC LIMIT 100000";
    $q=$pdo->prepare($sql);$q->execute($params);$rows=[['Kwitansi','Tanggal','NIS','Nama Siswa','Kelas','Tagihan','Nominal','Metode','Status','Diverifikasi Oleh','Alasan Void']];
    foreach($q->fetchAll()as$r)$rows[]=[$r['receipt'],$r['paid_at'],$r['nis'],$r['student_name'],$r['class_name']??'',$r['title'],(float)$r['amount'],$r['method'],(bool)$r['voided']?'VOID':'VALID',$r['verified_by']??'',$r['void_reason']??''];return$rows;
  }
  $params=[];$where=billWhere55($schoolId,$params,true);
  $sql="SELECT s.nis,s.name student_name,c.name class_name,s.guardian_name,s.guardian_phone,b.title,b.due_date,b.amount,b.status
    FROM bills b JOIN students s ON s.id=b.student_id LEFT JOIN classes c ON c.id=s.class_id WHERE $where ORDER BY b.due_date NULLS LAST,s.name,b.id LIMIT 100000";
  $q=$pdo->prepare($sql);$q->execute($params);$rows=[['NIS','Nama Siswa','Kelas','Nama Wali','No. HP Wali','Tagihan','Jatuh Tempo','Nominal','Status']];
  foreach($q->fetchAll()as$r)$rows[]=[$r['nis'],$r['student_name'],$r['class_name']??'',$r['guardian_name']??'',$r['guardian_phone']??'',$r['title'],$r['due_date'],(float)$r['amount'],$r['status']];return$rows;
}
function downloadCsv55(array $rows,string $filename):never{header_remove('Content-Type');header('Content-Type: text/csv; charset=utf-8');header('Content-Disposition: attachment; filename="'.$filename.'"');echo "\xEF\xBB\xBF";$out=fopen('php://output','w');foreach($rows as$row)fputcsv($out,$row,',','"','\\');fclose($out);exit;}
function xml55(string $v):string{return htmlspecialchars($v,ENT_XML1|ENT_QUOTES,'UTF-8');}
function col55(int $n):string{$s='';while($n>0){$n--; $s=chr(65+($n%26)).$s;$n=intdiv($n,26);}return$s;}
function downloadXlsx55(array $rows,string $filename):never{
  if(!class_exists('ZipArchive'))r55(501,['ok'=>false,'message'=>'Ekspor XLSX membutuhkan PHP Zip. Jalankan upgrade V5.5.']);
  $tmp=tempnam(sys_get_temp_dir(),'edupay-xlsx-');$zip=new ZipArchive();if($zip->open($tmp,ZipArchive::CREATE|ZipArchive::OVERWRITE)!==true)r55(500,['ok'=>false,'message'=>'Gagal membuat file XLSX']);
  $sheet='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
  foreach($rows as$ri=>$row){$rn=$ri+1;$sheet.='<row r="'.$rn.'">';foreach(array_values($row)as$ci=>$value){$ref=col55($ci+1).$rn;if(is_int($value)||is_float($value))$sheet.='<c r="'.$ref.'" t="n"><v>'.(string)$value.'</v></c>';else$sheet.='<c r="'.$ref.'" t="inlineStr"><is><t>'.xml55((string)$value).'</t></is></c>';}$sheet.='</row>';}$sheet.='</sheetData></worksheet>';
  $zip->addFromString('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  $zip->addFromString('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  $zip->addFromString('xl/workbook.xml','<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="EduPay" sheetId="1" r:id="rId1"/></sheets></workbook>');
  $zip->addFromString('xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
  $zip->addFromString('xl/worksheets/sheet1.xml',$sheet);$zip->close();
  header_remove('Content-Type');header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');header('Content-Disposition: attachment; filename="'.$filename.'"');header('Content-Length: '.filesize($tmp));readfile($tmp);@unlink($tmp);exit;
}

$pdo=db55($config);$schoolId=school55($pdo,$config);$path=parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)?:'/';$method=$_SERVER['REQUEST_METHOD']??'GET';

if($path==='/api/v55/health'&&$method==='GET')r55(200,['ok'=>true,'version'=>'5.5','server_pagination'=>true,'sql_dashboard'=>true,'server_exports'=>true]);

if($path==='/api/v55/meta'&&$method==='GET'){auth55(['admin','finance']);r55(200,['ok'=>true,'school'=>schoolRow55($pdo,$schoolId),'classes'=>classes55($pdo,$schoolId)]);}
if($path==='/api/v55/admin/master'&&$method==='GET'){auth55(['admin']);r55(200,['ok'=>true,'school'=>schoolRow55($pdo,$schoolId),'classes'=>classes55($pdo,$schoolId),'homeroomTeachers'=>teachers55($pdo,$schoolId),'feeTypes'=>fees55($pdo,$schoolId)]);}

if($path==='/api/v55/dashboard'&&$method==='GET'){
  auth55(['admin','finance']);
  $q=$pdo->prepare("SELECT
    COALESCE(SUM(amount) FILTER (WHERE status<>'cancelled'),0) total_billed,
    COALESCE(SUM(amount) FILTER (WHERE status='paid'),0) paid_amount,
    COALESCE(SUM(amount) FILTER (WHERE status='unpaid'),0) unpaid_amount,
    COALESCE(SUM(amount) FILTER (WHERE status='pending'),0) pending_amount,
    COUNT(*) FILTER (WHERE status='pending') pending_count,
    COUNT(*) FILTER (WHERE status='unpaid' AND due_date<CURRENT_DATE) overdue_count
    FROM bills WHERE school_id=?");$q->execute([$schoolId]);$bill=$q->fetch();
  $q=$pdo->prepare("SELECT COALESCE(SUM(amount) FILTER (WHERE voided=FALSE AND paid_at::date=CURRENT_DATE),0) today,
    COALESCE(SUM(amount) FILTER (WHERE voided=FALSE AND date_trunc('month',paid_at)=date_trunc('month',CURRENT_DATE)),0) month
    FROM payments WHERE school_id=?");$q->execute([$schoolId]);$pay=$q->fetch();
  $q=$pdo->prepare("SELECT (SELECT COUNT(*) FROM students WHERE school_id=? AND active=TRUE) active_students,
    (SELECT COUNT(*) FROM users WHERE school_id=? AND role='parent' AND status='active') active_guardians");$q->execute([$schoolId,$schoolId]);$people=$q->fetch();
  $q=$pdo->prepare("SELECT p.id,p.receipt,p.amount,p.method,p.paid_at,p.voided,s.name student_name,b.title FROM payments p JOIN students s ON s.id=p.student_id JOIN bills b ON b.id=p.bill_id WHERE p.school_id=? ORDER BY p.paid_at DESC,p.id DESC LIMIT 5");$q->execute([$schoolId]);$latest=[];foreach($q->fetchAll()as$r)$latest[]=['id'=>(int)$r['id'],'receipt'=>$r['receipt'],'amount'=>(float)$r['amount'],'method'=>$r['method'],'paidAt'=>$r['paid_at'],'voided'=>(bool)$r['voided'],'studentName'=>$r['student_name'],'title'=>$r['title']];
  r55(200,['ok'=>true,'summary'=>['totalBilled'=>(float)$bill['total_billed'],'paid'=>(float)$bill['paid_amount'],'unpaid'=>(float)$bill['unpaid_amount'],'pendingAmount'=>(float)$bill['pending_amount'],'pendingCount'=>(int)$bill['pending_count'],'overdueCount'=>(int)$bill['overdue_count'],'today'=>(float)$pay['today'],'month'=>(float)$pay['month'],'activeStudents'=>(int)$people['active_students'],'activeGuardians'=>(int)$people['active_guardians']],'latestPayments'=>$latest,'serverTime'=>date(DATE_ATOM)]);
}

if($path==='/api/v55/students'&&$method==='GET'){
  auth55(['admin']);[$page,$per,$offset]=page55();$params=[];$where=studentWhere55($schoolId,$params);
  $c=$pdo->prepare("SELECT COUNT(*) FROM students s WHERE $where");$c->execute($params);$total=(int)$c->fetchColumn();
  $q=$pdo->prepare("SELECT s.id,s.nis,s.name,s.class_id,s.guardian_name,s.guardian_phone,s.active,c.name class_name FROM students s LEFT JOIN classes c ON c.id=s.class_id WHERE $where ORDER BY s.active DESC,s.name,s.id LIMIT $per OFFSET $offset");$q->execute($params);$items=[];foreach($q->fetchAll()as$r)$items[]=['id'=>(int)$r['id'],'nis'=>$r['nis'],'name'=>$r['name'],'classId'=>$r['class_id']?(int)$r['class_id']:null,'className'=>$r['class_name']??'','parent'=>$r['guardian_name']??'','phone'=>$r['guardian_phone']??'','active'=>(bool)$r['active']];r55(200,['ok'=>true]+paged55($items,$total,$page,$per));
}
if($path==='/api/v55/students/lookup'&&$method==='GET'){
  auth55(['admin']);$qtext=qp55('q');if(mb_strlen($qtext)<1)r55(200,['ok'=>true,'items'=>[]]);$p=prefix55($qtext);$q=$pdo->prepare("SELECT s.id,s.nis,s.name,c.name class_name FROM students s LEFT JOIN classes c ON c.id=s.class_id WHERE s.school_id=? AND s.active=TRUE AND (LOWER(s.name) LIKE ? OR LOWER(s.nis) LIKE ?) ORDER BY s.name,s.id LIMIT 20");$q->execute([$schoolId,$p,$p]);$items=[];foreach($q->fetchAll()as$r)$items[]=['id'=>(int)$r['id'],'nis'=>$r['nis'],'name'=>$r['name'],'className'=>$r['class_name']??''];r55(200,['ok'=>true,'items'=>$items]);
}

if($path==='/api/v55/guardians'&&$method==='GET'){
  auth55(['admin']);[$page,$per,$offset]=page55();$params=[$schoolId];$where="u.school_id=? AND u.role='parent'";$status=qp55('status','all');if(in_array($status,['active','invited','not_invited','disabled'],true)){$where.=' AND u.status=?';$params[]=$status;}$qtext=qp55('q');if($qtext!==''){$p=prefix55($qtext);$where.=" AND (LOWER(u.name) LIKE ? OR LOWER(u.username) LIKE ? OR EXISTS(SELECT 1 FROM guardian_students gx JOIN students sx ON sx.id=gx.student_id WHERE gx.guardian_user_id=u.id AND LOWER(sx.name) LIKE ?))";array_push($params,$p,$p,$p);}
  $c=$pdo->prepare("SELECT COUNT(*) FROM users u WHERE $where");$c->execute($params);$total=(int)$c->fetchColumn();
  $sql="SELECT u.id,u.name,u.username,u.status,u.salutation,u.nickname,u.locked_until,u.last_login_at,u.updated_at,
    COALESCE(g.child_count,0) child_count,COALESCE(g.children,'') children
    FROM users u LEFT JOIN LATERAL(SELECT COUNT(*) child_count,STRING_AGG(s.name || COALESCE(' · '||c.name,''),', ' ORDER BY s.name) children FROM guardian_students gs JOIN students s ON s.id=gs.student_id LEFT JOIN classes c ON c.id=s.class_id WHERE gs.guardian_user_id=u.id) g ON TRUE
    WHERE $where ORDER BY u.name,u.id LIMIT $per OFFSET $offset";$q=$pdo->prepare($sql);$q->execute($params);$items=[];foreach($q->fetchAll()as$r)$items[]=['id'=>(int)$r['id'],'name'=>$r['name'],'username'=>$r['username'],'status'=>$r['status'],'salutation'=>$r['salutation'],'nickname'=>$r['nickname'],'locked_until'=>$r['locked_until'],'last_login_at'=>$r['last_login_at'],'childCount'=>(int)$r['child_count'],'children'=>$r['children']];r55(200,['ok'=>true]+paged55($items,$total,$page,$per));
}

if($path==='/api/v55/bills'&&$method==='GET'){
  auth55(['admin','finance']);[$page,$per,$offset]=page55();$params=[];$where=billWhere55($schoolId,$params,false);$c=$pdo->prepare("SELECT COUNT(*) FROM bills b JOIN students s ON s.id=b.student_id WHERE $where");$c->execute($params);$total=(int)$c->fetchColumn();
  $sql="SELECT b.id,b.student_id,b.title,b.amount,b.due_date,b.status,b.payment_method,b.updated_at,s.nis,s.name student_name,s.guardian_name,s.guardian_phone,c.name class_name FROM bills b JOIN students s ON s.id=b.student_id LEFT JOIN classes c ON c.id=s.class_id WHERE $where ORDER BY b.id DESC LIMIT $per OFFSET $offset";$q=$pdo->prepare($sql);$q->execute($params);$items=[];foreach($q->fetchAll()as$r)$items[]=['id'=>(int)$r['id'],'studentId'=>(int)$r['student_id'],'nis'=>$r['nis'],'studentName'=>$r['student_name'],'className'=>$r['class_name']??'','guardianName'=>$r['guardian_name']??'','guardianPhone'=>$r['guardian_phone']??'','title'=>$r['title'],'amount'=>(float)$r['amount'],'due'=>$r['due_date'],'status'=>$r['status'],'paymentMethod'=>$r['payment_method'],'updatedAt'=>$r['updated_at']];r55(200,['ok'=>true]+paged55($items,$total,$page,$per));
}

if($path==='/api/v55/payments'&&$method==='GET'){
  auth55(['admin','finance']);[$page,$per,$offset]=page55();$params=[];$where=paymentWhere55($schoolId,$params);$c=$pdo->prepare("SELECT COUNT(*) FROM payments p JOIN students s ON s.id=p.student_id JOIN bills b ON b.id=p.bill_id WHERE $where");$c->execute($params);$total=(int)$c->fetchColumn();
  $sql="SELECT p.id,p.bill_id,p.student_id,p.receipt,p.amount,p.method,p.paid_at,p.voided,p.voided_at,p.void_reason,s.nis,s.name student_name,c.name class_name,b.title,u.name verified_by FROM payments p JOIN students s ON s.id=p.student_id LEFT JOIN classes c ON c.id=s.class_id JOIN bills b ON b.id=p.bill_id LEFT JOIN users u ON u.id=p.verified_by WHERE $where ORDER BY p.paid_at DESC,p.id DESC LIMIT $per OFFSET $offset";$q=$pdo->prepare($sql);$q->execute($params);$items=[];foreach($q->fetchAll()as$r)$items[]=['id'=>(int)$r['id'],'billId'=>(int)$r['bill_id'],'studentId'=>(int)$r['student_id'],'receipt'=>$r['receipt'],'amount'=>(float)$r['amount'],'method'=>$r['method'],'paidAt'=>$r['paid_at'],'date'=>substr((string)$r['paid_at'],0,10),'voided'=>(bool)$r['voided'],'voidedAt'=>$r['voided_at'],'voidReason'=>$r['void_reason'],'nis'=>$r['nis'],'studentName'=>$r['student_name'],'className'=>$r['class_name']??'','title'=>$r['title'],'verifiedBy'=>$r['verified_by']??''];r55(200,['ok'=>true]+paged55($items,$total,$page,$per));
}

if($path==='/api/v55/reports/summary'&&$method==='GET'){
  auth55(['admin','finance']);$params=[];$where=paymentWhere55($schoolId,$params);$q=$pdo->prepare("SELECT COUNT(*) FILTER(WHERE p.voided=FALSE) transactions,COALESCE(SUM(p.amount) FILTER(WHERE p.voided=FALSE),0) received,COALESCE(SUM(p.amount) FILTER(WHERE p.voided=TRUE),0) voided_amount FROM payments p JOIN students s ON s.id=p.student_id JOIN bills b ON b.id=p.bill_id WHERE $where");$q->execute($params);$pay=$q->fetch();
  $aParams=[];$aWhere=billWhere55($schoolId,$aParams,true);$q=$pdo->prepare("SELECT COUNT(*) bills,COUNT(DISTINCT b.student_id) students,COALESCE(SUM(b.amount),0) amount,COUNT(*) FILTER(WHERE b.due_date<CURRENT_DATE) overdue_bills,COALESCE(SUM(b.amount) FILTER(WHERE b.due_date<CURRENT_DATE),0) overdue_amount FROM bills b JOIN students s ON s.id=b.student_id WHERE $aWhere");$q->execute($aParams);$arr=$q->fetch();
  $methodParams=[];$methodWhere=paymentWhere55($schoolId,$methodParams);$q=$pdo->prepare("SELECT p.method,COUNT(*) transactions,COALESCE(SUM(p.amount),0) amount FROM payments p JOIN students s ON s.id=p.student_id JOIN bills b ON b.id=p.bill_id WHERE $methodWhere AND p.voided=FALSE GROUP BY p.method ORDER BY amount DESC");$q->execute($methodParams);$byMethod=[];foreach($q->fetchAll()as$r)$byMethod[]=['method'=>$r['method'],'transactions'=>(int)$r['transactions'],'amount'=>(float)$r['amount']];
  r55(200,['ok'=>true,'payments'=>['transactions'=>(int)$pay['transactions'],'received'=>(float)$pay['received'],'voidedAmount'=>(float)$pay['voided_amount']],'arrears'=>['bills'=>(int)$arr['bills'],'students'=>(int)$arr['students'],'amount'=>(float)$arr['amount'],'overdueBills'=>(int)$arr['overdue_bills'],'overdueAmount'=>(float)$arr['overdue_amount']],'byMethod'=>$byMethod,'serverTime'=>date(DATE_ATOM)]);
}
if($path==='/api/v55/reports/arrears'&&$method==='GET'){
  auth55(['admin','finance']);[$page,$per,$offset]=page55();$params=[];$where=billWhere55($schoolId,$params,true);$c=$pdo->prepare("SELECT COUNT(*) FROM bills b JOIN students s ON s.id=b.student_id WHERE $where");$c->execute($params);$total=(int)$c->fetchColumn();$q=$pdo->prepare("SELECT b.id,b.title,b.amount,b.due_date,b.status,s.nis,s.name student_name,s.guardian_name,s.guardian_phone,c.name class_name FROM bills b JOIN students s ON s.id=b.student_id LEFT JOIN classes c ON c.id=s.class_id WHERE $where ORDER BY b.due_date NULLS LAST,s.name,b.id LIMIT $per OFFSET $offset");$q->execute($params);$items=[];foreach($q->fetchAll()as$r)$items[]=['id'=>(int)$r['id'],'nis'=>$r['nis'],'studentName'=>$r['student_name'],'className'=>$r['class_name']??'','guardianName'=>$r['guardian_name']??'','guardianPhone'=>$r['guardian_phone']??'','title'=>$r['title'],'amount'=>(float)$r['amount'],'due'=>$r['due_date'],'status'=>$r['status']];r55(200,['ok'=>true]+paged55($items,$total,$page,$per));
}

if(preg_match('#^/api/v55/export/(payments|arrears)$#',$path,$m)&&$method==='GET'){
  auth55(['admin','finance']);$type=$m[1];$format=strtolower(qp55('format','xlsx'));if(!in_array($format,['csv','xlsx'],true))r55(422,['ok'=>false,'message'=>'Format export harus CSV atau XLSX']);$rows=exportRows55($pdo,$schoolId,$type);$stamp=date('Ymd-His');$base='EduPay-'.($type==='payments'?'Penerimaan':'Tunggakan').'-'.$stamp;if($format==='csv')downloadCsv55($rows,$base.'.csv');downloadXlsx55($rows,$base.'.xlsx');
}

r55(404,['ok'=>false,'message'=>'Endpoint V5.5 tidak ditemukan']);
