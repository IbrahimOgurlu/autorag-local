const chat = document.querySelector('#chat');
const form = document.querySelector('#form');
const input = document.querySelector('#question');
const send = form.querySelector('button');
const escapeHtml = value => value.replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' })[char]);
function renderText(value) { return escapeHtml(value).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/^- (.*)$/gm, '<li>$1</li>').replace(/\n/g, '<br>').replace(/(<li>.*?<\/li>(<br>)?)+/g, m => `<ul>${m.replaceAll('<br>','')}</ul>`); }
function addUser(text) { const node = document.querySelector('#userTemplate').content.cloneNode(true); node.querySelector('div').textContent = text; chat.append(node); }
function addAssistant(text, sources = []) { const node = document.querySelector('#assistantTemplate').content.cloneNode(true); const box = node.querySelector('.assistant > div:last-child'); box.innerHTML = renderText(text); if (sources.length) { const sourceBox = document.createElement('div'); sourceBox.className = 'sources'; sourceBox.textContent = `KAYNAK: ${sources.map(s => s.title).join(' • ')}`; box.append(sourceBox); } chat.append(node); chat.scrollTop = chat.scrollHeight; }
async function ask(question) { addUser(question); input.value = ''; send.disabled = true; send.innerHTML = 'Aranıyor…'; try { const response = await fetch('/api/chat', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({question}) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); document.querySelector('#mode').textContent = `${result.mode} ile yanıtlandı`; addAssistant(result.text, result.sources); } catch (error) { addAssistant(`Bir hata oluştu: ${error.message}`); } finally { send.disabled = false; send.innerHTML = 'Gönder <span>↗</span>'; input.focus(); } }
form.addEventListener('submit', event => { event.preventDefault(); ask(input.value.trim()); });
document.querySelectorAll('.suggestions button').forEach(button => button.addEventListener('click', () => ask(button.textContent)));
