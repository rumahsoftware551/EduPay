// EduPay V5.4.1 - Restore permanent guardian activation entry in production login.
(function(){
  const previousLoginView=window.loginView;
  window.loginView=function(){
    let html=previousLoginView();
    if(html.includes('guardian-login-tools-v541')||html.includes('guardian-login-tools-v36'))return html;
    const tools=`<div class="guardian-login-tools-v36 guardian-login-tools-v541"><button type="button" onclick="openGuardianActivationV36()"><b>Aktivasi Akun Wali</b><span>Buat password pertama kali</span></button><button type="button" onclick="guardianForgotHelpV36()"><b>Lupa Password?</b><span>Hubungi admin untuk reset akses</span></button></div>`;
    const marker=html.match(/<div class="demo-card[^"]*">/);
    if(marker)return html.replace(marker[0],tools+marker[0]);
    return html.replace('</form>',`</form>${tools}`);
  };
  if(typeof render==='function')render();
})();
