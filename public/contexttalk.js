/* ContextTalk client app. Запускается из app/page.tsx после монтирования. */
(function(){
'use strict';
const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const store={get(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
const BCP={ru:'ru-RU',zh:'zh-CN',en:'en-US',es:'es-ES',fr:'fr-FR',de:'de-DE',ja:'ja-JP',ko:'ko-KR',ar:'ar-SA',pl:'pl-PL'},CODES=Object.keys(BCP),UIS=['ru','en','zh','pl'];
const MONO={zh:'中',ja:'日',ko:'한',ar:'ع'};

/* ===== i18n: [ru, en, zh]. Названия языков берутся из Intl.DisplayNames на языке интерфейса ===== */
const D={
st_idle:["Коснитесь, чтобы начать|Дальше просто говорите — кнопки не нужны","Tap to start|Then just talk — no buttons needed","点按开始|之后直接说话即可，无需按键"],
st_listening:["Слушаю...|Говорите, я переведу","Listening...|Speak, I'll translate","正在聆听…|请说话，我来翻译"],
st_processing:["Обрабатываю...|","Processing...|","处理中…|"],st_understanding:["Учитываю контекст...|","Using context...|","理解上下文…|"],st_translating:["Перевожу...|","Translating...|","翻译中…|"],
st_speaking:["Говорю...|Начните говорить, чтобы прервать","Speaking...|Start talking to interrupt","朗读中…|开口说话即可打断"],
st_error:["Не получилось|Коснитесь, чтобы повторить","Something went wrong|Tap to retry","出错了|点按重试"],
e_nosr:["Распознавание речи недоступно в этом браузере — пишите текстом","Speech recognition isn't available in this browser — type instead","此浏览器不支持语音识别，请改用文字"],
e_mic:["Нет доступа к микрофону — разрешите его или пишите текстом","Microphone blocked — allow access or type instead","无法使用麦克风，请授权或改用文字"],
e_err:["Ошибка: ","Error: ","错误："],
e_nomock:["Демо-словарь не знает эту фразу — подключите TranslationProvider","The demo dictionary doesn't know this phrase — connect a TranslationProvider","演示词典不含此句，请接入 TranslationProvider"],
you:["Вы","You","你"],them:["Собеседник","Partner","对方"],demo:["демо-перевод","demo translation","演示翻译"],nomock:["перевод не подключён","no translator connected","未接入翻译"],
hist:["История","History","历史"],hint_sel:["Нажмите и удерживайте сообщение, чтобы выбрать","Press and hold a message to select","长按消息以选择"],empty_h:["Здесь появятся ваши разговоры","Your conversations will appear here","对话将显示在这里"],
a_again:["Перевести снова","Translate again","重新翻译"],a_copy:["Копировать","Copy","复制"],a_listen:["Слушать","Listen","朗读"],a_explain:["Объяснить","Explain","解释"],a_ctx:["В контекст","Add to context","加入上下文"],a_del:["Удалить","Delete","删除"],a_x:["Отмена","Cancel","取消"],
n_copied:["Скопировано","Copied","已复制"],n_copyfail:["Не удалось скопировать","Couldn't copy","复制失败"],n_again:["Нужен настоящий TranslationProvider — сейчас только демо-словарь","Needs a real TranslationProvider — only the demo dictionary for now","需要真实的 TranslationProvider，目前仅有演示词典"],n_explain:["Объяснение появится вместе с языковой моделью","Explanations will arrive with a language model","接入语言模型后提供解释"],n_ctx:["Добавлено в контекст как подтверждённый факт","Added to context as a confirmed fact","已作为确认事实加入上下文"],n_del:["Удалено","Deleted","已删除"],
set:["Настройки","Settings","设置"],profile:["Профиль","Profile","个人资料"],theme:["Тема","Theme","主题"],themes:["Белая,Чёрная,Розовая,Серая,Aurora","White,Black,Pink,Gray,Aurora","白色,黑色,粉色,灰色,极光"],
ifl:["Язык интерфейса","Interface language","界面语言"],voice:["Голос озвучки","Voice","语音"],sysvoice:["Системный по умолчанию","System default","系统默认"],
ctxh:["Контекст разговора","Conversation context","对话上下文"],ctx_empty:["Пока пусто. Выберите сообщение в истории и нажмите «В контекст».","Empty for now. Select a message in History and tap “Add to context”.","暂无内容。在历史中选择消息并点击“加入上下文”。"],
kind:["Подтверждено,Предположение,Не уверен","Confirmed,Inference,Uncertain","已确认,推断,不确定"],
about:["О прототипе","About this prototype","关于原型"],about_t:["Работают: микрофон, распознавание и озвучка браузера, темы, история, выбор фрагментов. Перевод — демо-словарь.","Working: microphone, browser speech recognition and voice, themes, history, selection. Translation is a demo dictionary.","可用：麦克风、浏览器语音识别与朗读、主题、历史、片段选择。翻译为演示词典。"],
a_from:["Мой язык","My language","我的语言"],a_to:["Язык собеседника","Partner's language","对方语言"],a_swap:["Поменять языки","Swap languages","交换语言"],a_kb:["Текстовый ввод","Text input","文字输入"],a_send:["Отправить","Send","发送"],a_orb:["Начать разговор","Start conversation","开始对话"],ph:["Введите сообщение...","Type a message...","输入消息…"],
n_conv:["Разговор","Conversation","对话"],name:["Имя","Name","姓名"],listen1:["Прослушать","Play","播放"],dev:["Разработано","Developed by","开发者"]};
let UI=store.get('ui','ru');const ix=()=>UIS.indexOf(UI);
const PL={
st_idle:"Dotknij, aby zacząć|Potem po prostu mów — bez przycisków",st_listening:"Słucham...|Mów, ja przetłumaczę",st_processing:"Przetwarzam...|",st_understanding:"Uwzględniam kontekst...|",st_translating:"Tłumaczę...|",st_speaking:"Mówię...|Zacznij mówić, aby przerwać",st_error:"Coś poszło nie tak|Dotknij, aby spróbować ponownie",
e_nosr:"Rozpoznawanie mowy nie działa w tej przeglądarce — wpisz tekst",e_mic:"Brak dostępu do mikrofonu — zezwól na niego lub wpisz tekst",e_err:"Błąd: ",e_nomock:"Słownik demo nie zna tej frazy — podłącz TranslationProvider",
you:"Ty",them:"Rozmówca",demo:"tłumaczenie demo",nomock:"brak tłumacza",hist:"Historia",hint_sel:"Przytrzymaj wiadomość, aby ją zaznaczyć",empty_h:"Tutaj pojawią się Twoje rozmowy",
a_again:"Przetłumacz ponownie",a_copy:"Kopiuj",a_listen:"Odsłuchaj",a_explain:"Wyjaśnij",a_ctx:"Do kontekstu",a_del:"Usuń",a_x:"Anuluj",
n_copied:"Skopiowano",n_copyfail:"Nie udało się skopiować",n_again:"Potrzebny prawdziwy TranslationProvider — na razie tylko słownik demo",n_explain:"Wyjaśnienia pojawią się wraz z modelem językowym",n_ctx:"Dodano do kontekstu jako potwierdzony fakt",n_del:"Usunięto",
set:"Ustawienia",profile:"Profil",theme:"Motyw",themes:"Biały,Czarny,Różowy,Szary,Aurora",ifl:"Język interfejsu",voice:"Głos lektora",sysvoice:"Systemowy domyślny",ctxh:"Kontekst rozmowy",ctx_empty:"Na razie pusto. Zaznacz wiadomość w Historii i wybierz „Do kontekstu”.",kind:"Potwierdzone,Wnioskowanie,Niepewne",
about:"O prototypie",about_t:"Działa: mikrofon, rozpoznawanie mowy i głos przeglądarki, motywy, historia, zaznaczanie fragmentów. Tłumaczenie to słownik demo.",
a_from:"Mój język",a_to:"Język rozmówcy",a_swap:"Zamień języki",a_kb:"Wpisywanie tekstu",a_send:"Wyślij",a_orb:"Rozpocznij rozmowę",ph:"Wpisz wiadomość...",n_conv:"Rozmowa",name:"Imię",listen1:"Odtwórz",dev:"Stworzone przez"};
const t=k=>UI==='pl'?PL[k]:D[k][ix()],ta=k=>t(k).split(',');
const dn=(c,l)=>{try{const n=new Intl.DisplayNames([l],{type:'language'}).of(c);return n[0].toUpperCase()+n.slice(1)}catch{return c}};
const lname=c=>dn(c,UI),native=c=>dn(c,c);

Object.assign(D,{
m_denied:["Нет разрешения на микрофон. Разрешите доступ в настройках браузера (значок рядом с адресом) и повторите.","Microphone permission is off. Allow it in your browser settings (icon next to the address bar) and retry.","未授予麦克风权限。请在浏览器设置中允许后重试。"],
m_nodev:["Микрофон не найден. Подключите его или пишите текстом.","No microphone found. Connect one or type instead.","未找到麦克风。请连接或改用文字。"],
m_busy:["Микрофон занят другим приложением. Закройте его и повторите.","The microphone is in use by another app. Close it and retry.","麦克风被其他应用占用。请关闭后重试。"],
m_insecure:["Микрофону нужно защищённое соединение (HTTPS) или другой браузер.","The microphone needs a secure connection (HTTPS) or another browser.","麦克风需要安全连接（HTTPS）或更换浏览器。"],
m_net:["Нет сети для распознавания речи.","No network for speech recognition.","语音识别需要网络。"],
e_trans:["Ошибка перевода.","Translation failed.","翻译失败。"],
e_tts:["Не удалось озвучить — перевод показан текстом.","Couldn't play audio — the translation is shown as text.","无法朗读，译文已显示为文字。"],
retry:["Повторить","Retry","重试"],typeit:["Ввести текст","Type instead","改用文字"],
unt:["нет перевода (демо-словарь)","no translation (demo dictionary)","无译文（演示词典）"],v_na:["недоступен в этом браузере","unavailable in this browser","此浏览器不可用"]});
Object.assign(PL,{m_denied:"Brak zgody na mikrofon. Zezwól w ustawieniach przeglądarki i spróbuj ponownie.",m_nodev:"Nie znaleziono mikrofonu. Podłącz go lub pisz tekstem.",m_busy:"Mikrofon jest używany przez inną aplikację. Zamknij ją i spróbuj ponownie.",m_insecure:"Mikrofon wymaga bezpiecznego połączenia (HTTPS) lub innej przeglądarki.",m_net:"Brak sieci dla rozpoznawania mowy.",e_trans:"Błąd tłumaczenia.",e_tts:"Nie udało się odtworzyć — tłumaczenie widoczne jako tekst.",retry:"Ponów",typeit:"Wpisz tekst",unt:"brak tłumaczenia (słownik demo)",v_na:"niedostępny w tej przeglądarce"});

/* ===== PROVIDERS. mock:true/false — честная пометка ===== */
const IOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
// Микрофон: диагностика реальной причины отказа
const Mic={async acquire(){
 if(!window.isSecureContext)return{ok:false,code:'insecure'};
 if(!navigator.mediaDevices?.getUserMedia)return{ok:false,code:'insecure'};
 try{return{ok:true,stream:await navigator.mediaDevices.getUserMedia({audio:true})}}
 catch(e){const n=e?.name;
  if(n==='NotFoundError'||n==='DevicesNotFoundError'||n==='OverconstrainedError')return{ok:false,code:'nodev'};
  if(n==='NotReadableError'||n==='TrackStartError'||n==='AbortError')return{ok:false,code:'busy'};
  if(n==='NotAllowedError'||n==='PermissionDeniedError'||n==='SecurityError')return{ok:false,code:'denied'};
  return{ok:false,code:'error'}}}};
const SpeechProvider={mock:false,
 get supported(){return !!(window.SpeechRecognition||window.webkitSpeechRecognition)},
 start(lang,{onPartial,onFinal,onError}){
  const R=window.SpeechRecognition||window.webkitSpeechRecognition;const r=this.r=new R();let tm;this.on=true;
  r.lang=lang;r.continuous=true;r.interimResults=true;
  r.onresult=e=>{let s='',fin='';for(let i=e.resultIndex;i<e.results.length;i++){const x=e.results[i];(x.isFinal?fin+=x[0].transcript:s+=x[0].transcript)}
   onPartial(s||fin);clearTimeout(tm);tm=setTimeout(()=>{const v=(fin||s).trim();if(v)onFinal(v)},1300)};
  r.onerror=e=>{if(e.error!=='no-speech'&&e.error!=='aborted')onError(e.error)};
  r.onend=()=>{if(this.on)try{r.start()}catch{}};
  try{r.start()}catch{}},
 stop(){this.on=false;try{this.r?.abort()}catch{}}};
// Перевод: MOCK. Словарь на несколько фраз (ru/zh/en); неизвестное честно помечается как «нет перевода».
const nrm=s=>s.toLowerCase().replace(/ё/g,'е').replace(/[.,!?;:，。！？、]/g,'').replace(/\s+/g,' ').trim();
const PB=[['привет','你好','hello'],['привет, как твои дела?','你好，你最近怎么样？','hi, how are you?'],['спасибо','谢谢','thank you'],['спасибо большое','非常感谢','thank you very much'],['до свидания','再见','goodbye'],['да','是的','yes'],['нет','不','no'],['как тебя зовут?','你叫什么名字？','what is your name?'],['меня зовут анна','我叫安娜','my name is anna'],['где находится музей?','博物馆在哪里？','where is the museum?'],['я не понимаю','我不明白','i do not understand'],['помогите','请帮帮我','help me'],['я рад тебя видеть','我很高兴见到你','nice to see you'],['у меня всё хорошо, спасибо! а у тебя?','我很好，谢谢！你呢？','i am fine, thanks! and you?']].map(([ru,zh,en])=>({ru,zh,en}));
const TranslationProvider={mock:true,async translate(text,{from,to}){await new Promise(r=>setTimeout(r,300));
 const e=PB.find(p=>p[from]&&p[to]&&nrm(p[from])===nrm(text));
 return e?{text:e[to],translated:true,mock:true}:{text:'',translated:false,mock:true}}};
// Озвучка: реальный speechSynthesis. Голоса: Милена (ru), Мэй Цзя (zh-TW), Тин Тин (zh-CN), системный.
const VOICES={milena:/milena/i,meijia:/mei[\s-]?jia/i,tingting:/ting[\s-]?ting/i},VN={milena:'Милена',meijia:'Мэй Цзя',tingting:'Тин Тин'};
const vList=()=>('speechSynthesis' in window)?speechSynthesis.getVoices():[];
const findVoice=id=>VOICES[id]&&vList().find(v=>VOICES[id].test(v.name));
const pickVoice=lang=>{const v=findVoice(S.voice);return v&&v.lang.replace('_','-').slice(0,2)===lang.slice(0,2)?v:null};
const TTSProvider={mock:false,speak(text,lang){return new Promise(res=>{
  if(!('speechSynthesis' in window))return res({ok:false});
  try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=lang;const v=pickVoice(lang);if(v)u.voice=v;
   let done=false,tm;const end=r=>{if(!done){done=true;clearTimeout(tm);res(r)}};
   tm=setTimeout(()=>end({ok:true}),Math.max(5000,text.length*250));
   u.onend=()=>end({ok:true,voice:v?.name});u.onerror=e=>end({ok:e.error==='interrupted'||e.error==='canceled'});
   speechSynthesis.speak(u)}catch{res({ok:false})}})},
 stop(){try{speechSynthesis.cancel()}catch{}}};
const unlockTTS=()=>{try{const u=new SpeechSynthesisUtterance(' ');u.volume=0;speechSynthesis.speak(u)}catch{}};
document.addEventListener('pointerdown',unlockTTS,{once:true});
const ContextProvider={mock:false,facts:store.get('facts',[]),
 add(text,kind='confirmed'){this.facts.push({text,kind,at:Date.now()});store.set('facts',this.facts)},
 remove(i){this.facts.splice(i,1);store.set('facts',this.facts)},snapshot(){return this.facts.filter(f=>f.kind==='confirmed')}};
// Context Engine: общий для голоса и текста
const ContextEngine={build(msg,conv){return{facts:ContextProvider.snapshot(),from:msg.language,to:msg.targetLanguage,
 recent:(conv?.msgs||[]).filter(x=>x!==msg&&x.status==='translated').slice(-4).map(({speaker,originalText,translatedText})=>({speaker,originalText,translatedText}))}}};

/* ===== STATE ===== */
store.set('hist',null);
const loadHist=()=>store.get('hist2',[]).map(c=>({...c,msgs:c.msgs.map(m=>m.status==='pending'?{...m,status:'error'}:m)}));
const S={view:'conv',state:'idle',from:store.get('from','ru'),to:store.get('to','zh'),theme:store.get('theme','aurora'),voice:VOICES[store.get('voice','')]?store.get('voice',''):'',name:store.get('name','Гость'),live:false,speaking:false,run:0,queue:[],retry:null,sel:new Set(),open:null,cur:null,hist:loadHist(),stream:null,ac:null};
const BUSY=['processing','understanding','translating'];
const stateText=s=>t('st_'+(s==='interrupted'?'listening':s)).split('|');
function setState(s,hint){S.state=s;$('#orb').dataset.state=s;const [a,b]=stateText(s);$('#status').textContent=a;$('#hint').textContent=hint??b;if(s!=='error')$('#banner').hidden=true}
function toast(m){const e=$('#toast');e.textContent=m;e.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('on'),2600)}
const save=()=>store.set('hist2',S.hist);
const fmt=ts=>new Date(ts).toLocaleString(UI==='zh'?'zh-CN':UI,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const sp=x=>x==='user'?t('you'):t('them');
const pause=()=>new Promise(r=>setTimeout(r,120));
const tline=m=>m.status==='translated'?esc(m.translatedText):m.status==='pending'?'…':`<i>${m.status==='error'?t('e_trans'):t('unt')}</i>`;

/* ===== Ошибки: понятный текст + повтор ===== */
const EK={denied:'m_denied',nodev:'m_nodev',busy:'m_busy',insecure:'m_insecure',nosr:'e_nosr',net:'m_net',trans:'e_trans',error:'e_err'};
function fail(code,extra){S.live=false;cleanupMic();SpeechProvider.stop();setState('error','');
 $('#bmsg').textContent=t(EK[code]||'e_err')+(code==='error'&&extra?extra:'');
 const micCode=['denied','busy','insecure','error','net'].includes(code);
 const textOnly=code==='nodev'||code==='nosr';
 $('#bretry').textContent=textOnly?t('typeit'):t('retry');
 $('#bretry').onclick=()=>{if(textOnly){openCompose()}else if(S.retry){const f=S.retry;S.retry=null;f()}else startLive()};
 $('#banner').hidden=false;if(micCode)S.retry=null}

/* ===== Единый пайплайн: (текст | микрофон→STT) → Context → Translation → TTS ===== */
function commit(){save();renderMsgs();renderHist()}
function pushMsg(m){if(!S.cur){S.cur={id:Date.now(),a:S.from,b:S.to,at:Date.now(),msgs:[]};S.hist.unshift(S.cur)}S.cur.msgs.push(m);commit()}
async function pipeline(text,source,again){
 text=(text||'').trim();if(!text)return;const run=++S.run;
 let m=again;
 if(!m){m={id:Date.now()+'-'+Math.random().toString(36).slice(2,6),speaker:'user',originalText:text,translatedText:'',language:S.from,targetLanguage:S.to,timestamp:Date.now(),source,audio:null,context:0,status:'pending'};pushMsg(m)}
 else{m.status='pending';commit()}
 setState('processing');await pause();if(run!==S.run)return;
 setState('understanding');const ctx=ContextEngine.build(m,S.cur);m.context=ctx.facts.length;await pause();if(run!==S.run)return;
 setState('translating');let r;
 try{r=await TranslationProvider.translate(text,{from:m.language,to:m.targetLanguage,context:ctx})}
 catch{if(run!==S.run)return;m.status='error';commit();S.retry=()=>pipeline(text,source,m);return fail('trans')}
 if(run!==S.run)return;
 m.translatedText=r.text;m.mock=!!r.mock;m.status=r.translated?'translated':'untranslated';commit();
 if(r.translated){setState('speaking');S.speaking=true;const v=await TTSProvider.speak(r.text,BCP[m.targetLanguage]);S.speaking=false;if(run!==S.run)return;if(!v.ok)toast(t('e_tts'));return finish()}
 finish(t('e_nomock'))}
function finish(hint){const q=S.queue.shift();if(q)return pipeline(q.text,q.source);setState(S.live?'listening':'idle',hint)}
function submit(text,source){text=(text||'').trim();if(!text)return;
 if(BUSY.includes(S.state)){S.queue.push({text,source});return}
 if(S.speaking)interrupt();pipeline(text,source)}
function interrupt(){S.run++;TTSProvider.stop();S.speaking=false;setState('interrupted');setTimeout(()=>{if(S.state==='interrupted')setState(S.live?'listening':'idle')},250)}

/* ===== Микрофон ===== */
function cleanupMic(){S.stream?.getTracks().forEach(x=>x.stop());S.stream=null;try{S.ac?.close()}catch{}S.ac=null;$('#orb').style.setProperty('--lvl',0)}
function meter(stream){try{const c=S.ac=new AudioContext(),a=c.createAnalyser();a.fftSize=256;c.createMediaStreamSource(stream).connect(a);const d=new Uint8Array(a.frequencyBinCount);
 const tick=()=>{if(!S.live||!S.ac)return;a.getByteTimeDomainData(d);let m=0;for(const v of d)m+=Math.abs(v-128);$('#orb').style.setProperty('--lvl',S.state==='listening'?Math.min(1,m/d.length/28):0);requestAnimationFrame(tick)};tick()}catch{}}
async function startLive(){
 if(S.live)return;S.retry=null;$('#banner').hidden=true;
 const m=await Mic.acquire();if(!m.ok)return fail(m.code);
 if(!SpeechProvider.supported){m.stream.getTracks().forEach(x=>x.stop());return fail('nosr')}
 if(IOS)m.stream.getTracks().forEach(x=>x.stop());else{S.stream=m.stream}
 S.live=true;setState('listening');if(S.stream)meter(S.stream);
 SpeechProvider.start(BCP[S.from],{
  onPartial:x=>{if(S.speaking)interrupt();if(S.state==='listening')$('#hint').textContent=x},
  onFinal:x=>submit(x,'voice'),
  onError:e=>fail(e==='not-allowed'||e==='service-not-allowed'?'denied':e==='audio-capture'?'nodev':e==='network'?'net':'error',' '+e)})}
function stopLive(){S.live=false;S.queue=[];S.run++;S.speaking=false;SpeechProvider.stop();TTSProvider.stop();cleanupMic();setState('idle')}
$('#orb').onclick=()=>S.live?stopLive():startLive();
$('#orb').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#orb').click()}};

/* ===== Кастомный список выбора ===== */
const ck='<svg class="ic" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',chev='<svg class="ic" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';
function sheet(title,items,cur,pick){$('#sh').textContent=title;
 $('#sl').innerHTML=items.map(i=>`<button class="it" role="option" data-id="${esc(i.id)}" aria-selected="${i.id===cur}">${i.mono?`<span class="lc">${i.mono}</span>`:''}<span class="g"><b>${esc(i.label)}</b>${i.sub?`<span>${esc(i.sub)}</span>`:''}</span>${i.id===cur?ck:''}</button>`).join('');
 $('#sl').querySelectorAll('.it').forEach(b=>b.onclick=()=>{closeSheet();pick(b.dataset.id)});$('#ov').classList.add('on');($('#sl [aria-selected=true]')||$('#sl button'))?.focus()}
const closeSheet=()=>$('#ov').classList.remove('on');
$('#ov').onclick=e=>{if(e.target.id==='ov')closeSheet()};document.addEventListener('keydown',e=>e.key==='Escape'&&closeSheet());
const mono=c=>MONO[c]||c.toUpperCase();
const langItems=codes=>codes.map(c=>({id:c,label:lname(c),sub:native(c)!==lname(c)?native(c):'',mono:mono(c)}));

/* ===== Conversation UI ===== */
function msgHtml(m,extra=''){return `<small>${sp(m.speaker)}${extra}</small><div class="o">${esc(m.originalText)}</div><div class="t">${tline(m)}</div>${m.status==='translated'&&m.mock?`<div class="st">${t('demo')}</div>`:''}`}
function renderMsgs(){const ms=(S.cur?.msgs||[]).slice(-2);$('#msgs').innerHTML=ms.map((x,i)=>`<div class="msg glass">${msgHtml(x)}<button class="mini" aria-label="${t('listen1')}" data-i="${i}"><svg class="ic" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9zM17 9a4 4 0 0 1 0 6"/></svg></button></div>`).join('');
 $('#msgs').querySelectorAll('.mini').forEach(b=>b.onclick=async()=>{const x=ms[b.dataset.i];if(x.status!=='translated')return toast(t('unt'));const v=await TTSProvider.speak(x.translatedText,BCP[x.targetLanguage]);if(!v.ok)toast(t('e_tts'))})}
const langBtns=()=>{for(const k of ['from','to'])$('#'+k+'B').innerHTML=`<span class="lc">${mono(S[k])}</span><span class="ln">${esc(lname(S[k]))}</span>${chev}`};
function setLang(k,c){const o=k==='from'?'to':'from';if(c===S[o])S[o]=S[k];S[k]=c;store.set('from',S.from);store.set('to',S.to);if(S.live)stopLive();S.cur=null;renderMsgs();langBtns()}
$('#fromB').onclick=()=>sheet(t('a_from'),langItems(CODES),S.from,c=>setLang('from',c));
$('#toB').onclick=()=>sheet(t('a_to'),langItems(CODES),S.to,c=>setLang('to',c));
$('#swap').onclick=e=>{[S.from,S.to]=[S.to,S.from];store.set('from',S.from);store.set('to',S.to);e.currentTarget.classList.toggle('r');if(S.live)stopLive();S.cur=null;renderMsgs();langBtns()};
function openCompose(){$('#compose').classList.add('open');$('#txt').focus()}
$('#kb').onclick=()=>{$('#compose').classList.toggle('open');if($('#compose').classList.contains('open'))$('#txt').focus()};
function sendText(){const v=$('#txt').value.trim();if(!v)return;$('#txt').value='';submit(v,'text');$('#txt').focus()}
$('#send').onclick=sendText;$('#txt').onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();sendText()}};

/* ===== History ===== */
const langPair=c=>`${lname(c.a)} ↔ ${lname(c.b)}`;
function renderHist(){const v=$('#v-hist');
 if(S.open){const c=S.hist.find(x=>x.id===S.open);if(!c){S.open=null;return renderHist()}
  v.innerHTML=`<button class="row glass" id="back" style="min-height:48px"><svg class="ic" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg><b>${langPair(c)}</b><span>${fmt(c.at)}</span></button>
  <div class="bar glass ${S.sel.size?'on':''}">${['again','copy','listen','explain','ctx','del','x'].map(k=>`<button data-a="${k}">${t('a_'+k)}</button>`).join('')}</div>
  <div class="msgs">${c.msgs.map((m,i)=>`<div class="msg glass ${S.sel.has(i)?'sel':''}" data-i="${i}" tabindex="0">${msgHtml(m,' · '+esc(lname(m.language))+' · '+fmt(m.timestamp))}</div>`).join('')}</div>
  <p class="hint" style="margin-top:12px">${t('hint_sel')}</p>`;
  $('#back').onclick=()=>{S.open=null;S.sel.clear();renderHist()};
  v.querySelectorAll('.msg').forEach(el=>{const i=+el.dataset.i;let tm,lp=false;
   el.onpointerdown=()=>{lp=false;tm=setTimeout(()=>{lp=true;toggleSel(i)},450)};el.onpointerup=el.onpointerleave=()=>clearTimeout(tm);
   el.onclick=()=>{if(!lp&&S.sel.size)toggleSel(i)};el.onkeydown=e=>{if(e.key==='Enter')toggleSel(i)}});
  v.querySelectorAll('.bar button').forEach(b=>b.onclick=()=>act(b.dataset.a,c))
 }else{v.innerHTML=`<h2>${t('hist')}</h2>`+(S.hist.length?S.hist.map(c=>`<button class="row glass" data-id="${c.id}"><div class="g"><b>${langPair(c)}</b><span>${esc(c.msgs[0]?.originalText||'')} / ${esc(c.msgs[0]?.translatedText||'—')}</span></div><span>${fmt(c.at)}</span></button>`).join(''):`<p class="hint">${t('empty_h')}</p>`);
  v.querySelectorAll('.row').forEach(b=>b.onclick=()=>{S.open=+b.dataset.id;renderHist()})}}
function toggleSel(i){S.sel.has(i)?S.sel.delete(i):S.sel.add(i);navigator.vibrate?.(8);renderHist()}
async function act(a,c){const ms=[...S.sel].sort().map(i=>c.msgs[i]);
 if(a==='copy')navigator.clipboard?.writeText(ms.map(m=>m.originalText+'\n'+m.translatedText).join('\n\n')).then(()=>toast(t('n_copied')),()=>toast(t('n_copyfail')));
 else if(a==='listen'){const tx=ms.filter(m=>m.status==='translated');if(!tx.length)toast(t('unt'));else{const v=await TTSProvider.speak(tx.map(m=>m.translatedText).join('. '),BCP[c.b]);if(!v.ok)toast(t('e_tts'))}}
 else if(a==='again')toast(t('n_again'));
 else if(a==='explain')toast(t('n_explain'));
 else if(a==='ctx'){ms.forEach(m=>ContextProvider.add(m.originalText));toast(t('n_ctx'))}
 else if(a==='del'){c.msgs=c.msgs.filter((_,i)=>!S.sel.has(i));if(!c.msgs.length){S.hist=S.hist.filter(x=>x!==c);if(S.cur===c)S.cur=null}save();renderMsgs();toast(t('n_del'))}
 S.sel.clear();renderHist()}

/* ===== Settings ===== */
const THEMES=[['white','#fff'],['black','#111225'],['pink','linear-gradient(135deg,#ffd1e6,#ec4899)'],['gray','linear-gradient(135deg,#dfe3e8,#586172)'],['aurora','conic-gradient(#7c4dff,#22d3ee,#ff7ac8,#7c4dff)']];
function renderSet(){const tn=ta('themes'),kn=ta('kind'),vn=VN[S.voice]||t('sysvoice');
 $('#v-set').innerHTML=`<h2>${t('set')}</h2>
 <div class="row glass"><div class="av">${esc(S.name[0]||'?')}</div><div class="g"><b>${t('profile')}</b><input id="nm" value="${esc(S.name)}" aria-label="${t('name')}" style="background:none;border:0;border-bottom:1px solid var(--bd);width:100%;padding:4px 0"></div></div>
 <div class="sec">${t('theme')}</div><div class="themes">${THEMES.map(([k,c],i)=>`<button class="th" data-k="${k}" aria-pressed="${S.theme===k}"><i style="background:${c}"></i>${tn[i]}</button>`).join('')}</div>
 <div class="sec">${t('ifl')}</div><button class="row glass" id="uiB"><span class="lc">${mono(UI)}</span><div class="g"><b>${esc(lname(UI))}</b></div>${chev}</button>
 <div class="sec">${t('voice')}</div><button class="row glass" id="vB"><div class="g"><b>${esc(vn)}</b></div>${chev}</button>
 <div class="sec">${t('ctxh')}</div>${ContextProvider.facts.length?ContextProvider.facts.map((f,i)=>`<div class="row glass"><div class="g"><b style="font-weight:500;white-space:normal">${esc(f.text)}</b><span class="chip">${kn[['confirmed','inference','uncertain'].indexOf(f.kind)]}</span></div><button class="mini" style="position:static" data-r="${i}" aria-label="${t('a_del')}">✕</button></div>`).join(''):`<p class="hint" style="text-align:left;padding:0 4px">${t('ctx_empty')}</p>`}
 <div class="dev"><span>${t('dev')}</span><b>EliseWorldWide</b><i aria-hidden="true">R</i></div>`;
 $('#nm').onchange=e=>{S.name=e.target.value;store.set('name',S.name);renderSet()};
 $('#uiB').onclick=()=>sheet(t('ifl'),langItems(UIS),UI,c=>{UI=c;store.set('ui',c);applyUI()});
 $('#vB').onclick=()=>sheet(t('voice'),[{id:'',label:t('sysvoice')},...Object.keys(VN).map(id=>{const v=findVoice(id);return{id,label:VN[id],sub:v?v.lang:t('v_na')}})],S.voice,id=>{S.voice=id;store.set('voice',id);renderSet();const v=findVoice(id);if(id&&!v)toast(VN[id]+': '+t('v_na'))});
 document.querySelectorAll('.th').forEach(b=>b.onclick=()=>{setTheme(b.dataset.k);renderSet()});
 document.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{ContextProvider.remove(+b.dataset.r);renderSet()})}
function setTheme(k){S.theme=k;document.documentElement.dataset.theme=k;store.set('theme',k);document.querySelector('meta[name=theme-color]')?.setAttribute('content',getComputedStyle(document.documentElement).getPropertyValue('--bg').trim())}

/* ===== Язык интерфейса, навигация ===== */
function applyUI(){document.documentElement.lang=UI;
 [['#fromB','a_from'],['#toB','a_to'],['#swap','a_swap'],['#kb','a_kb'],['#send','a_send'],['#orb','a_orb']].forEach(([s,k])=>$(s).setAttribute('aria-label',t(k)));
 $('#txt').placeholder=t('ph');$('#txt').setAttribute('aria-label',t('ph'));
 document.querySelectorAll('nav button').forEach(b=>b.setAttribute('aria-label',t({conv:'n_conv',hist:'hist',set:'set'}[b.dataset.v])));
 langBtns();renderMsgs();renderHist();renderSet();
 if(S.state==='error'){$('#status').textContent=stateText('error')[0]}else setState(S.state)}
$('#nav').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.view=b.dataset.v;
 document.querySelectorAll('.view').forEach(v=>v.classList.toggle('on',v.id==='v-'+S.view));
 document.querySelectorAll('nav button').forEach(x=>x.setAttribute('aria-current',x===b));
 $('#compose').style.display=S.view==='conv'?'':'none';if(S.view==='set')renderSet();if(S.view==='hist')renderHist()};
if('speechSynthesis' in window)speechSynthesis.onvoiceschanged=()=>{if(S.view==='set')renderSet()};
setTheme(S.theme);applyUI();
})();
