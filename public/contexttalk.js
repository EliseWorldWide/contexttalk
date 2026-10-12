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


e_err:["Ошибка: ","Error: ","错误："],

you:["Вы","You","你"],them:["Собеседник","Partner","对方"],
hist:["История","History","历史"],hint_sel:["Нажмите и удерживайте сообщение, чтобы выбрать","Press and hold a message to select","长按消息以选择"],empty_h:["Здесь появятся ваши разговоры","Your conversations will appear here","对话将显示在这里"],
a_again:["Перевести снова","Translate again","重新翻译"],a_copy:["Копировать","Copy","复制"],a_listen:["Слушать","Listen","朗读"],a_explain:["Объяснить","Explain","解释"],a_ctx:["В контекст","Add to context","加入上下文"],a_del:["Удалить","Delete","删除"],a_x:["Отмена","Cancel","取消"],
n_copied:["Скопировано","Copied","已复制"],n_copyfail:["Не удалось скопировать","Couldn't copy","复制失败"],n_explain:["Объяснение появится вместе с языковой моделью","Explanations will arrive with a language model","接入语言模型后提供解释"],n_ctx:["Добавлено в контекст как подтверждённый факт","Added to context as a confirmed fact","已作为确认事实加入上下文"],n_del:["Удалено","Deleted","已删除"],
set:["Настройки","Settings","设置"],profile:["Профиль","Profile","个人资料"],theme:["Тема","Theme","主题"],themes:["Белая,Чёрная,Розовая,Серая,Aurora","White,Black,Pink,Gray,Aurora","白色,黑色,粉色,灰色,极光"],
ifl:["Язык интерфейса","Interface language","界面语言"],voice:["Голос озвучки","Voice","语音"],sysvoice:["Системный по умолчанию","System default","系统默认"],
ctxh:["Контекст разговора","Conversation context","对话上下文"],ctx_empty:["Пока пусто. Выберите сообщение в истории и нажмите «В контекст».","Empty for now. Select a message in History and tap “Add to context”.","暂无内容。在历史中选择消息并点击“加入上下文”。"],
kind:["Подтверждено,Предположение,Не уверен","Confirmed,Inference,Uncertain","已确认,推断,不确定"],

a_from:["Мой язык","My language","我的语言"],a_to:["Язык собеседника","Partner's language","对方语言"],a_swap:["Поменять языки","Swap languages","交换语言"],a_kb:["Текстовый ввод","Text input","文字输入"],a_send:["Отправить","Send","发送"],a_orb:["Начать разговор","Start conversation","开始对话"],ph:["Введите сообщение...","Type a message...","输入消息…"],
n_conv:["Разговор","Conversation","对话"],name:["Имя","Name","姓名"],listen1:["Прослушать","Play","播放"],dev:["Разработано","Developed by","开发者"]};
let UI=store.get('ui','ru');const ix=()=>UIS.indexOf(UI);
const PL={
st_idle:"Dotknij, aby zacząć|Potem po prostu mów — bez przycisków",st_listening:"Słucham...|Mów, ja przetłumaczę",st_processing:"Przetwarzam...|",st_understanding:"Uwzględniam kontekst...|",st_translating:"Tłumaczę...|",st_speaking:"Mówię...|Zacznij mówić, aby przerwać",st_error:"Coś poszło nie tak|Dotknij, aby spróbować ponownie",
e_err:"Błąd: ",
you:"Ty",them:"Rozmówca",hist:"Historia",hint_sel:"Przytrzymaj wiadomość, aby ją zaznaczyć",empty_h:"Tutaj pojawią się Twoje rozmowy",
a_again:"Przetłumacz ponownie",a_copy:"Kopiuj",a_listen:"Odsłuchaj",a_explain:"Wyjaśnij",a_ctx:"Do kontekstu",a_del:"Usuń",a_x:"Anuluj",
n_copied:"Skopiowano",n_copyfail:"Nie udało się skopiować",n_explain:"Wyjaśnienia pojawią się wraz z modelem językowym",n_ctx:"Dodano do kontekstu jako potwierdzony fakt",n_del:"Usunięto",
set:"Ustawienia",profile:"Profil",theme:"Motyw",themes:"Biały,Czarny,Różowy,Szary,Aurora",ifl:"Język interfejsu",voice:"Głos lektora",sysvoice:"Systemowy domyślny",ctxh:"Kontekst rozmowy",ctx_empty:"Na razie pusto. Zaznacz wiadomość w Historii i wybierz „Do kontekstu”.",kind:"Potwierdzone,Wnioskowanie,Niepewne",

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
v_na:["недоступен в этом браузере","unavailable in this browser","此浏览器不可用"]});
Object.assign(PL,{m_denied:"Brak zgody na mikrofon. Zezwól w ustawieniach przeglądarki i spróbuj ponownie.",m_nodev:"Nie znaleziono mikrofonu. Podłącz go lub pisz tekstem.",m_busy:"Mikrofon jest używany przez inną aplikację. Zamknij ją i spróbuj ponownie.",m_insecure:"Mikrofon wymaga bezpiecznego połączenia (HTTPS) lub innej przeglądarki.",m_net:"Brak sieci dla rozpoznawania mowy.",e_trans:"Błąd tłumaczenia.",e_tts:"Nie udało się odtworzyć — tłumaczenie widoczne jako tekst.",retry:"Ponów",typeit:"Wpisz tekst",v_na:"niedostępny w tej przeglądarce"});


/* ===== Дополнительные строки интерфейса: [ru, en, zh] + pl ===== */
const X=(k,ru,en,zh,pl)=>{D[k]=[ru,en,zh];PL[k]=pl};
X('ea_network','Не удалось подключиться к AI. Проверь интернет-соединение.',"Couldn't connect to the AI. Check your internet connection.",'无法连接到 AI，请检查网络连接。','Nie udało się połączyć z AI. Sprawdź połączenie z internetem.');
X('ea_not_configured','Сервис перевода не настроен: на сервере нет GEMINI_API_KEY.',"Translation isn't configured: GEMINI_API_KEY is missing on the server.",'翻译服务未配置：服务器缺少 GEMINI_API_KEY。','Tłumaczenie nie jest skonfigurowane: brak GEMINI_API_KEY na serwerze.');
X('ea_auth','Gemini отклонил ключ доступа. Проверьте GEMINI_API_KEY.','Gemini rejected the API key. Check GEMINI_API_KEY.','Gemini 拒绝了密钥，请检查 GEMINI_API_KEY。','Gemini odrzucił klucz. Sprawdź GEMINI_API_KEY.');
X('ea_rate_limited','Слишком много запросов. Подождите немного и повторите.','Too many requests. Wait a moment and retry.','请求过多，请稍后重试。','Zbyt wiele żądań. Poczekaj chwilę i spróbuj ponownie.');
X('ea_upstream','AI сейчас недоступен. Повторите через несколько секунд.','The AI is unavailable right now. Try again in a few seconds.','AI 暂时不可用，请几秒后重试。','AI jest chwilowo niedostępne. Spróbuj za kilka sekund.');
X('ea_bad_model_output','AI вернул непонятный ответ. Повторите попытку.','The AI returned an unexpected answer. Try again.','AI 返回了无法识别的结果，请重试。','AI zwróciło nieoczekiwaną odpowiedź. Spróbuj ponownie.');
X('ea_language_not_selected','Язык речи не входит в выбранные языки. Добавьте его в настройках.',"The spoken language isn't among the selected languages. Add it in Settings.",'所说语言不在已选语言中，请在设置中添加。','Język wypowiedzi nie jest wśród wybranych. Dodaj go w ustawieniach.');
X('ea_voice_rejected','Google не принял запись голоса. Перезапишите образец и фразу согласия заново — подряд и на одном микрофоне.','Google rejected the voice recording. Record the sample and the consent phrase again, back to back on the same microphone.','Google 未接受该录音。请在同一麦克风上连续重新录制样本和同意语句。','Google odrzucił nagranie głosu. Nagraj próbkę i zdanie zgody ponownie, jedno po drugim, na tym samym mikrofonie.');
X('ea_consent_required','Нужно подтвердить согласие на использование голоса.','You need to confirm consent to use the voice.','需要确认同意使用该声音。','Musisz potwierdzić zgodę na użycie głosu.');
X('ea_other','Не удалось выполнить действие. Повторите попытку.','Something went wrong. Please try again.','操作失败，请重试。','Coś poszło nie tak. Spróbuj ponownie.');
X('ea_live','Режим Live недоступен, перевод идёт запасным путём (чуть медленнее)','Live mode is unavailable; translation continues via a fallback path (slightly slower)','Live 模式不可用，翻译将通过备用方式进行（稍慢）','Tryb Live jest niedostępny; tłumaczenie działa awaryjnie (nieco wolniej)');
X('newc','Новая беседа','New conversation','新对话','Nowa rozmowa');
X('n_newc','Начата новая беседа: контекст очищен','New conversation started: context cleared','已开始新对话：上下文已清空','Rozpoczęto nową rozmowę: kontekst wyczyszczony');
X('n_ctx_partial','Добавлено как ваш факт; AI не смог разобрать детали',"Added as your fact; the AI couldn't parse the details",'已作为你的事实添加；AI 未能解析细节','Dodano jako Twój fakt; AI nie rozłożyło szczegółów');
X('n_explain','Объяснение появится в следующей версии','Explanations are coming in a future version','解释功能将在后续版本推出','Wyjaśnienia pojawią się w kolejnej wersji');
X('mode','Режим перевода','Translation mode','翻译模式','Tryb tłumaczenia');
X('mode_contextual','Контекстный','Contextual','语境','Kontekstowy');X('mode_natural','Естественный','Natural','自然','Naturalny');X('mode_literal','Буквальный','Literal','直译','Dosłowny');
X('langs','Языки разговора','Conversation languages','对话语言','Języki rozmowy');
X('voices','Голоса','Voices','声音','Głosy');
X('v_user','Мой голос','My voice','我的声音','Mój głos');X('v_partner','Голос собеседника',"Partner's voice",'对方的声音','Głos rozmówcy');
X('v_none','Не записан','Not recorded','未录制','Nie nagrano');X('v_ready','Голос готов','Voice ready','声音已就绪','Głos gotowy');
X('v_intro','Запишите 10–30 секунд естественной речи.','Record 10–30 seconds of natural speech.','请录制 10–30 秒自然说话。','Nagraj 10–30 sekund naturalnej mowy.');
X('v_tip','Затем вы прочитаете фразу согласия. Запишите оба шага подряд, в тишине и на одном микрофоне.',"You'll then read a consent phrase. Do both steps back to back, in a quiet place, on the same microphone.",'随后朗读同意语句。请在安静环境中用同一麦克风连续完成两步。','Potem przeczytasz zdanie zgody. Wykonaj oba kroki jeden po drugim, w ciszy, na tym samym mikrofonie.');
X('v_rec','Начать запись','Start recording','开始录音','Rozpocznij nagrywanie');X('v_stop','Остановить','Stop','停止','Zatrzymaj');
X('v_consent_intro','Прочитайте вслух фразу согласия:','Read the consent phrase aloud:','请大声朗读同意语句：','Przeczytaj na głos zdanie zgody:');
X('v_confirm','Подтверждаю, что это мой голос, и разрешаю его использовать.','I confirm this is my voice and I allow it to be used.','我确认这是我的声音，并允许使用。','Potwierdzam, że to mój głos, i zezwalam na jego użycie.');
X('v_create','Создать голос','Create voice','创建声音','Utwórz głos');X('v_creating','Создаю голос…','Creating voice…','正在创建声音…','Tworzę głos…');
X('v_done','Голос создан','Voice created','声音已创建','Głos utworzony');X('v_rerecord','Перезаписать','Re-record','重新录制','Nagraj ponownie');X('v_delete','Удалить голос','Delete voice','删除声音','Usuń głos');

/* ===== STATE ===== */
['hist','hist2','facts','voice'].forEach(k=>{try{localStorage.removeItem(k)}catch{}});
const CT=window.ContextTalk;
const loadHist=()=>store.get('hist3',[]).map(c=>({...c,msgs:c.msgs.map(m=>m.status==='pending'?{...m,status:'error'}:m)}));
const S={view:'conv',state:'idle',from:store.get('from','ru'),to:store.get('to','zh'),selected:store.get('selected',[]),mode:store.get('mode','contextual'),theme:store.get('theme','aurora'),name:store.get('name','Гость'),voices:store.get('voices',{}),sel:new Set(),open:null,cur:null,hist:loadHist()};
S.selected=[...new Set([S.from,S.to,...S.selected])].filter(c=>CODES.includes(c));
const stateText=s=>t('st_'+(s==='interrupted'?'listening':s)).split('|');
function setState(s,hint){S.state=s;$('#orb').dataset.state=s;const [a,b]=stateText(s);$('#status').textContent=a;$('#hint').textContent=hint??b;if(s!=='error')$('#banner').hidden=true}
function toast(m){const e=$('#toast');e.textContent=m;e.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('on'),6000)}
const save=()=>store.set('hist3',S.hist);
const fmt=ts=>new Date(ts).toLocaleString(UI==='zh'?'zh-CN':UI,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const sp=x=>x==='user'?t('you'):t('them');
const tline=m=>m.status==='translated'?esc(m.translatedText):m.status==='pending'?'…':`<i>${t('ea_other')}</i>`;

/* ===== Ошибки: понятный текст + повтор ===== */
function errText(code,msg){if(code==='live')return t('ea_live')+(msg?' ('+msg+')':'');const k='ea_'+code;if(D[k])return t(k);if(['denied','nodev','busy','insecure'].includes(code))return t('m_'+code);return t('ea_other')}
function showErr(e){setState('error','');$('#bmsg').textContent=errText(e.code,e.message);const textOnly=e.code==='nodev';
 $('#bretry').textContent=textOnly?t('typeit'):t('retry');
 $('#bretry').onclick=()=>{$('#banner').hidden=true;if(textOnly)openCompose();else if(e.retry)e.retry();else ctl.start()};$('#banner').hidden=false}

/* ===== Контроллер разговора (TypeScript-ядро: микрофон → Gemini Live → контекст → перевод → озвучка) ===== */
function engineInit(){const saved=store.get('ctx',null);let e=saved&&saved.conversationId&&saved.speakers?new CT.ContextEngine(saved):null;
 if(!e)e=CT.ContextEngine.create({userLanguage:S.from,partnerLanguage:S.to,selectedLanguages:S.selected,userName:S.name});
 e.setLanguages(S.from,S.to,S.selected);e.setVoice('user',S.voices.user?.voiceId);e.setVoice('partner',S.voices.partner?.voiceId);return e}
const ctl=new CT.ConversationController(engineInit(),{
 state:s=>setState(s),
 message:m=>upsertMsg(m),
 level:l=>$('#orb').style.setProperty('--lvl',l),
 partial:x=>{if(S.state==='listening'&&x)$('#hint').textContent=x},
 error:showErr,
 notice:(c,m)=>toast(c==='tts'?t('e_tts'):errText(c,m)),
 context:()=>store.set('ctx',ctl.engine.state)});
ctl.setMode(S.mode);
S.cur=S.hist.find(c=>c.id===ctl.engine.state.conversationId)||null;
function commit(){save();renderMsgs();renderHist()}
function upsertMsg(m){const st=ctl.engine.state;if(!S.cur||S.cur.id!==st.conversationId)S.cur=S.hist.find(c=>c.id===st.conversationId)||null;
 if(!S.cur){S.cur={id:st.conversationId,a:st.speakers.user.language,b:st.speakers.partner.language,at:Date.now(),msgs:[]};S.hist.unshift(S.cur)}
 const i=S.cur.msgs.findIndex(x=>x.id===m.id);i>=0?S.cur.msgs[i]=m:S.cur.msgs.push(m);commit()}
function newConv(silent){if(ctl.isListening)ctl.stop();ctl.setLanguages(S.from,S.to,S.selected);ctl.newConversation();S.cur=null;renderMsgs();if(!silent)toast(t('n_newc'))}
$('#orb').onclick=()=>ctl.isListening?ctl.stop():ctl.start();
$('#orb').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#orb').click()}};
$('#newc').onclick=()=>newConv();

/* ===== Кастомный список выбора ===== */
const ck='<svg class="ic" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',chev='<svg class="ic" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';
function sheet(title,items,cur,pick){$('#sh').textContent=title;
 $('#sl').innerHTML=items.map(i=>`<button class="it" role="option" data-id="${esc(i.id)}" aria-selected="${i.id===cur}">${i.mono?`<span class="lc">${i.mono}</span>`:''}<span class="g"><b>${esc(i.label)}</b>${i.sub?`<span>${esc(i.sub)}</span>`:''}</span>${i.id===cur?ck:''}</button>`).join('');
 $('#sl').querySelectorAll('.it').forEach(b=>b.onclick=()=>{closeSheet();pick(b.dataset.id)});$('#ov').classList.add('on');($('#sl [aria-selected=true]')||$('#sl button'))?.focus()}
let onSheetClose=null;
const closeSheet=()=>{$('#ov').classList.remove('on');const f=onSheetClose;onSheetClose=null;if(f)f()};
function openHtmlSheet(title,html,onClose){$('#sh').textContent=title;$('#sl').innerHTML=html;onSheetClose=onClose||null;$('#ov').classList.add('on')}
function msheet(title,items,cur,change){$('#sh').textContent=title;const draw=()=>{$('#sl').innerHTML=items.map(i=>`<button class="it" role="option" data-id="${esc(i.id)}" aria-selected="${cur.has(i.id)}"><span class="lc">${i.mono}</span><span class="g"><b>${esc(i.label)}</b>${i.sub?`<span>${esc(i.sub)}</span>`:''}</span>${cur.has(i.id)?ck:''}</button>`).join('');$('#sl').querySelectorAll('.it').forEach(b=>b.onclick=()=>{const id=b.dataset.id;if(cur.has(id)){if(id!==S.from&&id!==S.to)cur.delete(id)}else cur.add(id);change([...cur]);draw()})};draw();onSheetClose=null;$('#ov').classList.add('on')}
$('#ov').onclick=e=>{if(e.target.id==='ov')closeSheet()};document.addEventListener('keydown',e=>e.key==='Escape'&&closeSheet());
const mono=c=>MONO[c]||c.toUpperCase();
const langItems=codes=>codes.map(c=>({id:c,label:lname(c),sub:native(c)!==lname(c)?native(c):'',mono:mono(c)}));

/* ===== Conversation UI ===== */
function msgHtml(m,extra=''){return `<small>${sp(m.speakerId)}${extra}</small><div class="o">${esc(m.originalText)}</div><div class="t">${tline(m)}</div>`}
function renderMsgs(){const ms=(S.cur?.msgs||[]).slice(-2);$('#msgs').innerHTML=ms.map((x,i)=>`<div class="msg glass">${msgHtml(x)}<button class="mini" aria-label="${t('listen1')}" data-i="${i}"><svg class="ic" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9zM17 9a4 4 0 0 1 0 6"/></svg></button></div>`).join('');
 $('#msgs').querySelectorAll('.mini').forEach(b=>b.onclick=()=>ctl.replay(ms[b.dataset.i]))}
const langBtns=()=>{for(const k of ['from','to'])$('#'+k+'B').innerHTML=`<span class="lc">${mono(S[k])}</span><span class="ln">${esc(lname(S[k]))}</span>${chev}`};
function setLang(k,c){const o=k==='from'?'to':'from';if(c===S[o])S[o]=S[k];S[k]=c;S.selected=[...new Set([S.from,S.to,...S.selected])];store.set('from',S.from);store.set('to',S.to);store.set('selected',S.selected);newConv(true);langBtns()}
$('#fromB').onclick=()=>sheet(t('a_from'),langItems(CODES),S.from,c=>setLang('from',c));
$('#toB').onclick=()=>sheet(t('a_to'),langItems(CODES),S.to,c=>setLang('to',c));
$('#swap').onclick=e=>{[S.from,S.to]=[S.to,S.from];store.set('from',S.from);store.set('to',S.to);e.currentTarget.classList.toggle('r');newConv(true);langBtns()};
function openCompose(){$('#compose').classList.add('open');$('#txt').focus()}
$('#kb').onclick=()=>{$('#compose').classList.toggle('open');if($('#compose').classList.contains('open'))$('#txt').focus()};
function sendText(){const v=$('#txt').value.trim();if(!v)return;$('#txt').value='';ctl.submitText(v);$('#txt').focus()}
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
 }else{v.innerHTML=`<h2>${t('hist')}</h2>`+(S.hist.length?S.hist.map(c=>`<button class="row glass" data-id="${c.id}"><div class="g"><b>${langPair(c)}</b><span>${esc(c.msgs[0]?.originalText||'')} / ${esc(c.msgs[0]?.translatedText||'…')}</span></div><span>${fmt(c.at)}</span></button>`).join(''):`<p class="hint">${t('empty_h')}</p>`);
  v.querySelectorAll('.row').forEach(b=>b.onclick=()=>{S.open=b.dataset.id;renderHist()})}}
function toggleSel(i){S.sel.has(i)?S.sel.delete(i):S.sel.add(i);navigator.vibrate?.(8);renderHist()}
async function act(a,c){const ms=[...S.sel].sort((x,y)=>x-y).map(i=>c.msgs[i]);
 if(a==='copy')navigator.clipboard?.writeText(ms.map(m=>m.originalText+'\n'+m.translatedText).join('\n\n')).then(()=>toast(t('n_copied')),()=>toast(t('n_copyfail')));
 else if(a==='listen'){for(const m of ms)await ctl.replay(m)}
 else if(a==='again'){S.sel.clear();document.querySelector('nav button[data-v=conv]').click();for(const m of ms)await ctl.submitText(m.originalText);return}
 else if(a==='explain')toast(t('n_explain'));
 else if(a==='ctx'){const r=await Promise.all(ms.map(m=>ctl.addToContext(m.originalText)));toast(r.every(x=>x==='ok')?t('n_ctx'):t('n_ctx_partial'))}
 else if(a==='del'){c.msgs=c.msgs.filter((_,i)=>!S.sel.has(i));if(!c.msgs.length){S.hist=S.hist.filter(x=>x!==c);if(S.cur===c)S.cur=null}save();renderMsgs();toast(t('n_del'))}
 S.sel.clear();renderHist()}

/* ===== Settings ===== */
const THEMES=[['white','#fff'],['black','#111225'],['pink','linear-gradient(135deg,#ffd1e6,#ec4899)'],['gray','linear-gradient(135deg,#dfe3e8,#586172)'],['aurora','conic-gradient(#7c4dff,#22d3ee,#ff7ac8,#7c4dff)']];
const MODES=['contextual','natural','literal'];
function renderSet(){const tn=ta('themes'),kn=ta('kind'),facts=ctl.engine.state.facts;
 const vrow=(role,lang)=>{const p=S.voices[role];return `<button class="row glass" data-vr="${role}"><div class="g"><b>${t('v_'+role)}</b><span>${p?`${t('v_ready')} · ${esc(lname(p.language))}`:t('v_none')}</span></div>${chev}</button>`};
 $('#v-set').innerHTML=`<h2>${t('set')}</h2>
 <div class="row glass"><div class="av">${esc(S.name[0]||'?')}</div><div class="g"><b>${t('profile')}</b><input id="nm" value="${esc(S.name)}" aria-label="${t('name')}" style="background:none;border:0;border-bottom:1px solid var(--bd);width:100%;padding:4px 0"></div></div>
 <div class="sec">${t('theme')}</div><div class="themes">${THEMES.map(([k,c],i)=>`<button class="th" data-k="${k}" aria-pressed="${S.theme===k}"><i style="background:${c}"></i>${tn[i]}</button>`).join('')}</div>
 <div class="sec">${t('ifl')}</div><button class="row glass" id="uiB"><span class="lc">${mono(UI)}</span><div class="g"><b>${esc(lname(UI))}</b></div>${chev}</button>
 <div class="sec">${t('langs')}</div><button class="row glass" id="lB"><div class="g"><b style="white-space:normal">${S.selected.map(lname).join(', ')}</b></div>${chev}</button>
 <div class="sec">${t('mode')}</div><button class="row glass" id="mB"><div class="g"><b>${t('mode_'+S.mode)}</b></div>${chev}</button>
 <div class="sec">${t('voices')}</div>${vrow('user',S.from)}${vrow('partner',S.to)}
 <div class="sec">${t('ctxh')}</div>${facts.length?facts.map(f=>`<div class="row glass"><div class="g"><b style="font-weight:500;white-space:normal">${esc(f.text)}</b><span class="chip">${kn[['confirmed','inference','uncertain'].indexOf(f.kind)]}</span></div><button class="mini" style="position:static" data-r="${f.id}" aria-label="${t('a_del')}">✕</button></div>`).join(''):`<p class="hint" style="text-align:left;padding:0 4px">${t('ctx_empty')}</p>`}
 <div class="dev"><span>${t('dev')}</span><b>EliseWorldWide</b><i aria-hidden="true">R</i></div>`;
 $('#nm').onchange=e=>{S.name=e.target.value;store.set('name',S.name);ctl.engine.state.speakers.user.name=S.name;store.set('ctx',ctl.engine.state);renderSet()};
 $('#uiB').onclick=()=>sheet(t('ifl'),langItems(UIS),UI,c=>{UI=c;store.set('ui',c);applyUI()});
 $('#lB').onclick=()=>msheet(t('langs'),langItems(CODES),new Set(S.selected),arr=>{S.selected=arr;store.set('selected',arr);ctl.setLanguages(S.from,S.to,arr);renderSet()});
 $('#mB').onclick=()=>sheet(t('mode'),MODES.map(m=>({id:m,label:t('mode_'+m)})),S.mode,m=>{S.mode=m;store.set('mode',m);ctl.setMode(m);renderSet()});
 document.querySelectorAll('[data-vr]').forEach(b=>b.onclick=()=>voiceFlow(b.dataset.vr));
 document.querySelectorAll('.th').forEach(b=>b.onclick=()=>{setTheme(b.dataset.k);renderSet()});
 document.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{ctl.engine.removeFact(b.dataset.r);store.set('ctx',ctl.engine.state);renderSet()})}

// Запись голосового профиля: образец → фраза согласия → подтверждение → создание. Записи живут только в памяти и удаляются сразу после отправки.
function voiceFlow(role){
 const lang=role==='user'?S.from:S.to,info=CT.languageInfo(lang),min=CT.REFERENCE_SECONDS.min,max=CT.REFERENCE_SECONDS.max,p=S.voices[role];
 let rec=null,ref=null,consent=null;
 const box=h=>{$('#sl').innerHTML=h};
 const done=()=>{try{rec?.close()}catch{}rec=null;ref=consent=null};
 const phrase=`<div class="msg glass" style="padding:14px;margin:8px 0">${esc(info.consent)}</div>`;
 const step={
  home(){if(p){box(`<p class="hint" style="text-align:left;margin:6px">${t('v_ready')} · ${esc(lname(p.language))}</p><div class="ba" style="justify-content:flex-start"><button class="bb" id="vRe">${t('v_rerecord')}</button><button class="bb" id="vDel">${t('v_delete')}</button></div>`);$('#vRe').onclick=step.intro;$('#vDel').onclick=step.del}else step.intro()},
  intro(){done();box(`<p style="margin:6px">${t('v_intro')}</p><p class="hint" style="text-align:left;margin:6px">${t('v_tip')}</p><div class="ba"><button class="bb" id="vGo">${t('v_rec')}</button></div>`);$('#vGo').onclick=step.rec1},
  async rec1(){try{rec=new CT.VoiceRecorder();await rec.open()}catch(e){done();return step.err(errText(e&&e.name==='InsecureContext'?'insecure':CT.classifyMicError(e)))}
   const finish=()=>{if(!rec||ref)return;ref=rec.stopSegment();step.consent()};
   rec.onLevel=(r,sec)=>{const el=$('#vT');if(el)el.textContent=Math.floor(sec)+' / '+max;const b=$('#vStop');if(b)b.disabled=sec<min;if(sec>=max)finish()};
   box(`<p style="margin:6px">${t('v_intro')}</p><div class="status" id="vT" style="font-size:28px;margin:14px 0">0 / ${max}</div><div class="ba"><button class="bb" id="vStop" disabled>${t('v_stop')}</button></div>`);
   rec.startSegment();$('#vStop').onclick=finish},
  consent(){box(`<p class="hint" style="text-align:left;margin:6px">${t('v_consent_intro')}</p>${phrase}<div class="ba"><button class="bb" id="vGo2">${t('v_rec')}</button></div>`);
   $('#vGo2').onclick=()=>{rec.onLevel=(r,sec)=>{const b=$('#vStop2');if(b)b.disabled=sec<2};rec.startSegment();
    box(`<p class="hint" style="text-align:left;margin:6px">${t('v_consent_intro')}</p>${phrase}<div class="ba"><button class="bb" id="vStop2" disabled>${t('v_stop')}</button></div>`);
    $('#vStop2').onclick=()=>{consent=rec.stopSegment();rec.close();rec=null;step.confirm()}}},
  confirm(){box(`<label style="display:flex;gap:10px;align-items:flex-start;margin:10px 6px"><input type="checkbox" id="vCk" style="width:22px;height:22px;flex:none;margin-top:2px"><span>${t('v_confirm')}</span></label><div class="ba"><button class="bb" id="vMk" disabled>${t('v_create')}</button></div>`);
   $('#vCk').onchange=e=>{$('#vMk').disabled=!e.target.checked};
   $('#vMk').onclick=async()=>{box(`<p class="status" style="font-size:16px;margin:20px 0">${t('v_creating')}</p>`);
    try{const prof=await CT.api.createVoice({role,language:lang,displayName:S.name||role,referenceWavBase64:ref.wavBase64,consentWavBase64:consent.wavBase64,consentConfirmed:true});
     ref=consent=null;S.voices[role]=prof;store.set('voices',S.voices);ctl.setVoice(role,prof.voiceId);closeSheet();renderSet();toast(t('v_done'))}
    catch(e){ref=consent=null;step.err(errText(e.code||'other',e.message))}}},
  err(msg){box(`<p style="margin:8px">${esc(msg)}</p><div class="ba"><button class="bb" id="vR">${t('retry')}</button></div>`);$('#vR').onclick=step.intro},
  async del(){try{await CT.api.deleteVoice(p)}catch(e){return step.err(errText(e.code||'other',e.message))}delete S.voices[role];store.set('voices',S.voices);ctl.setVoice(role,undefined);closeSheet();renderSet();toast(t('n_del'))}
 };
 openHtmlSheet(t('v_'+role),'',done);step.home()}
function setTheme(k){S.theme=k;document.documentElement.dataset.theme=k;store.set('theme',k);document.querySelector('meta[name=theme-color]')?.setAttribute('content',getComputedStyle(document.documentElement).getPropertyValue('--bg').trim())}

/* ===== Язык интерфейса, навигация ===== */
function applyUI(){document.documentElement.lang=UI;
 [['#newc','newc'],['#fromB','a_from'],['#toB','a_to'],['#swap','a_swap'],['#kb','a_kb'],['#send','a_send'],['#orb','a_orb']].forEach(([s,k])=>$(s).setAttribute('aria-label',t(k)));
 $('#txt').placeholder=t('ph');$('#txt').setAttribute('aria-label',t('ph'));
 document.querySelectorAll('nav button').forEach(b=>b.setAttribute('aria-label',t({conv:'n_conv',hist:'hist',set:'set'}[b.dataset.v])));
 langBtns();renderMsgs();renderHist();renderSet();
 if(S.state==='error'){$('#status').textContent=stateText('error')[0]}else setState(S.state)}
$('#nav').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.view=b.dataset.v;
 document.querySelectorAll('.view').forEach(v=>v.classList.toggle('on',v.id==='v-'+S.view));
 document.querySelectorAll('nav button').forEach(x=>x.setAttribute('aria-current',x===b));
 $('#compose').style.display=S.view==='conv'?'':'none';if(S.view==='set')renderSet();if(S.view==='hist')renderHist()};
setTheme(S.theme);applyUI();
})();
