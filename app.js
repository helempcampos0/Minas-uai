// Chave pública (anon). Pode ficar no código: o acesso aos dados é protegido pelas regras (RLS) do banco.
const SUPABASE_URL = 'https://rygxxrcuveqktrbwiayo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_3Ha4gEqDYBlBG4fF1eU1Dw_T0mUu-17';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);

const estado = {
  produtos: [],
  lancamentos: [],
  mes: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
};

const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (n) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dataBR = (iso) => iso.split('-').reverse().join('/');
const chaveMes = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

function mostrar(tela) {
  for (const t of ['tela-login', 'tela-sem-acesso', 'tela-app']) $(t).hidden = t !== tela;
  $('abas').hidden = tela !== 'tela-app';
  $('btn-sair').hidden = tela === 'tela-login';
  $('btn-senha').hidden = tela !== 'tela-app';
}

function msg(id, texto, erro = false) {
  $(id).textContent = texto;
  $(id).classList.toggle('erro', erro);
}

// ---------- Login ----------

$('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  msg('login-msg', 'Entrando…');
  const { error } = await db.auth.signInWithPassword({
    email: $('login-email').value.trim(),
    password: $('login-senha').value,
  });
  if (error) msg('login-msg', 'E-mail ou senha errados.', true);
  else msg('login-msg', '');
});

$('btn-senha').addEventListener('click', async () => {
  const nova = prompt('Digite a nova senha (mínimo 6 letras ou números):');
  if (!nova) return;
  if (nova.length < 6) { alert('A senha precisa ter pelo menos 6 caracteres.'); return; }
  const { error } = await db.auth.updateUser({ password: nova });
  alert(error ? 'Erro: ' + error.message : 'Senha trocada!');
});

$('btn-sair').addEventListener('click', async () => {
  await db.auth.signOut();
  mostrar('tela-login');
});

let iniciado = false;
db.auth.onAuthStateChange((_evento, sessao) => {
  // Adia para fora do callback, como recomenda a biblioteca.
  setTimeout(() => entrar(sessao), 0);
});

async function entrar(sessao) {
  if (!sessao) { iniciado = false; mostrar('tela-login'); return; }
  if (iniciado) return;
  iniciado = true;
  const email = sessao.user.email;
  const { data, error } = await db.from('membros').select('email').limit(1);
  if (error || !data.length) {
    $('sem-acesso-email').textContent = email;
    mostrar('tela-sem-acesso');
    return;
  }
  mostrar('tela-app');
  $('lanc-data').value = hoje();
  await carregar();
}

// ---------- Dados ----------

async function carregar() {
  const [p, l] = await Promise.all([
    db.from('produtos').select('*').order('nome'),
    db.from('lancamentos').select('*').order('data', { ascending: false }).order('criado_em', { ascending: false }),
  ]);
  if (p.error || l.error) { alert('Erro ao carregar: ' + (p.error || l.error).message); return; }
  estado.produtos = p.data;
  estado.lancamentos = l.data;
  desenhar();
}

function desenhar() {
  const nomeMes = estado.mes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  $('mes-atual').textContent = nomeMes[0].toUpperCase() + nomeMes.slice(1);
  desenharResumo();
  desenharHistorico();
  desenharProdutos();
  desenharSelects();
}

const doMes = () => estado.lancamentos.filter((l) => l.data.startsWith(chaveMes(estado.mes)));

function estoqueDe(prod) {
  // Venda (entrada de dinheiro) tira do estoque; compra (saída de dinheiro) põe no estoque.
  let q = Number(prod.estoque_inicial);
  for (const l of estado.lancamentos) {
    if (l.produto_id !== prod.id) continue;
    q += l.tipo === 'entrada' ? -Number(l.qtd) : Number(l.qtd);
  }
  return q;
}

function desenharResumo() {
  const ls = doMes();
  const soma = (f) => ls.filter(f).reduce((s, l) => s + Number(l.valor), 0);
  const entradas = soma((l) => l.tipo === 'entrada' && l.pago);
  const saidas = soma((l) => l.tipo === 'saida' && l.pago);
  $('k-entradas').textContent = brl(entradas);
  $('k-saidas').textContent = brl(saidas);
  $('k-saldo').textContent = brl(entradas - saidas);
  $('k-saldo').className = entradas - saidas >= 0 ? 'pos' : 'neg';
  $('k-receber').textContent = brl(soma((l) => l.tipo === 'entrada' && !l.pago));
  $('k-pagar').textContent = brl(soma((l) => l.tipo === 'saida' && !l.pago));
  $('k-vendidos').textContent = num(ls.filter((l) => l.tipo === 'entrada' && l.produto_id).reduce((s, l) => s + Number(l.qtd), 0));

  const comEstoque = estado.produtos.filter((p) => p.controla_estoque);
  $('lista-estoque').innerHTML = comEstoque.length
    ? comEstoque.map((p) => {
        const q = estoqueDe(p);
        return `<li><div class="info">${esc(p.nome)}</div><div class="valor ${q < 0 ? 'neg' : ''}">${num(q)} ${esc(p.unidade)}</div></li>`;
      }).join('')
    : '<li class="vazio">Cadastre produtos na aba Produtos.</li>';
}

function desenharHistorico() {
  const ls = doMes();
  const nomeProd = Object.fromEntries(estado.produtos.map((p) => [p.id, p]));
  $('lista-lanc').innerHTML = ls.length
    ? ls.map((l) => {
        const p = nomeProd[l.produto_id];
        const detalhe = [dataBR(l.data), l.categoria, p ? `${num(l.qtd)} ${p.unidade} de ${p.nome}` : null].filter(Boolean).map(esc).join(' · ');
        return `<li>
          <div class="info">${esc(l.descricao || (l.tipo === 'entrada' ? 'Entrada' : 'Saída'))}${l.pago ? '' : `<span class="etiqueta">${l.tipo === 'entrada' ? 'a receber' : 'a pagar'}</span>`}
            <small>${detalhe}</small></div>
          <div class="valor ${l.tipo === 'entrada' ? 'pos' : 'neg'}">${l.tipo === 'entrada' ? '+' : '−'}${brl(l.valor)}</div>
          <div class="acoes">
            ${l.pago ? '' : `<button class="link" data-pagar="${l.id}">Pago</button>`}
            <button class="link" data-editar="${l.id}">Editar</button>
            <button class="link" data-apagar="${l.id}">Apagar</button>
          </div></li>`;
      }).join('')
    : '<li class="vazio">Nenhum lançamento neste mês.</li>';
}

function desenharProdutos() {
  $('lista-prod').innerHTML = estado.produtos.length
    ? estado.produtos.map((p) => `<li>
        <div class="info">${esc(p.nome)}<small>${brl(p.preco)} / ${esc(p.unidade)}${p.controla_estoque ? ` · estoque ${num(estoqueDe(p))}` : ''}</small></div>
        <div class="acoes">
          <button class="link" data-editar-prod="${p.id}">Editar</button>
          <button class="link" data-apagar-prod="${p.id}">Apagar</button>
        </div></li>`).join('')
    : '<li class="vazio">Nenhum produto ainda.</li>';
}

function desenharSelects() {
  const atual = $('lanc-produto').value;
  $('lanc-produto').innerHTML = '<option value="">— nenhum —</option>' +
    estado.produtos.map((p) => `<option value="${p.id}">${esc(p.nome)} (${brl(p.preco)})</option>`).join('');
  $('lanc-produto').value = atual;
  const cats = [...new Set(estado.lancamentos.map((l) => l.categoria).filter(Boolean))];
  $('categorias').innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join('');
}

// ---------- Navegação ----------

$('abas').addEventListener('click', (e) => {
  const aba = e.target.dataset.aba;
  if (!aba) return;
  for (const b of $('abas').children) b.classList.toggle('ativa', b === e.target);
  for (const s of document.querySelectorAll('.aba')) s.hidden = s.id !== 'aba-' + aba;
  $('tela-app').querySelector('.mes').hidden = aba === 'lancar' || aba === 'produtos';
  window.scrollTo(0, 0);
});

document.querySelector('.mes').addEventListener('click', (e) => {
  const passo = Number(e.target.dataset.mes);
  if (!passo) return;
  estado.mes = new Date(estado.mes.getFullYear(), estado.mes.getMonth() + passo, 1);
  desenhar();
});

function irPara(aba) {
  document.querySelector(`[data-aba="${aba}"]`).click();
}

// ---------- Lançamentos ----------

function tipoLanc() { return document.querySelector('input[name=tipo]:checked').value; }

function sugerirValor() {
  const p = estado.produtos.find((x) => x.id === $('lanc-produto').value);
  $('campo-qtd').hidden = !p;
  if (p && tipoLanc() === 'entrada') {
    const total = Number($('lanc-qtd').value) * Number(p.preco);
    if (total > 0) $('lanc-valor').value = total.toFixed(2);
  }
}
$('lanc-produto').addEventListener('change', () => {
  const p = estado.produtos.find((x) => x.id === $('lanc-produto').value);
  if (p && !$('lanc-desc').value) $('lanc-desc').value = (tipoLanc() === 'entrada' ? 'Venda de ' : 'Compra de ') + p.nome;
  sugerirValor();
});
$('lanc-qtd').addEventListener('input', sugerirValor);

function limparLanc() {
  $('form-lanc').reset();
  $('lanc-id').value = '';
  $('lanc-data').value = hoje();
  $('campo-qtd').hidden = true;
  $('btn-cancelar-lanc').hidden = true;
  $('btn-salvar-lanc').textContent = 'Salvar';
}
$('btn-cancelar-lanc').addEventListener('click', () => { limparLanc(); msg('lanc-msg', ''); });

$('form-lanc').addEventListener('submit', async (e) => {
  e.preventDefault();
  const produto_id = $('lanc-produto').value || null;
  const linha = {
    tipo: tipoLanc(),
    produto_id,
    qtd: produto_id ? Number($('lanc-qtd').value) || 0 : 0,
    valor: Number($('lanc-valor').value),
    descricao: $('lanc-desc').value.trim(),
    categoria: $('lanc-cat').value.trim() || null,
    data: $('lanc-data').value,
    pago: $('lanc-pago').checked,
  };
  const id = $('lanc-id').value;
  msg('lanc-msg', 'Salvando…');
  const { error } = id
    ? await db.from('lancamentos').update(linha).eq('id', id)
    : await db.from('lancamentos').insert(linha);
  if (error) { msg('lanc-msg', 'Erro: ' + error.message, true); return; }
  limparLanc();
  msg('lanc-msg', id ? 'Lançamento atualizado.' : 'Lançamento salvo!');
  await carregar();
});

$('lista-lanc').addEventListener('click', async (e) => {
  const { pagar, editar, apagar } = e.target.dataset;
  if (pagar) {
    const { error } = await db.from('lancamentos').update({ pago: true }).eq('id', pagar);
    if (error) alert('Erro: ' + error.message); else await carregar();
  } else if (apagar) {
    if (!confirm('Apagar este lançamento?')) return;
    const { error } = await db.from('lancamentos').delete().eq('id', apagar);
    if (error) alert('Erro: ' + error.message); else await carregar();
  } else if (editar) {
    const l = estado.lancamentos.find((x) => x.id === editar);
    irPara('lancar');
    $('lanc-id').value = l.id;
    document.querySelector(`input[name=tipo][value=${l.tipo}]`).checked = true;
    $('lanc-produto').value = l.produto_id || '';
    $('campo-qtd').hidden = !l.produto_id;
    $('lanc-qtd').value = l.qtd;
    $('lanc-valor').value = l.valor;
    $('lanc-desc').value = l.descricao;
    $('lanc-cat').value = l.categoria || '';
    $('lanc-data').value = l.data;
    $('lanc-pago').checked = l.pago;
    $('btn-cancelar-lanc').hidden = false;
    $('btn-salvar-lanc').textContent = 'Salvar alterações';
    msg('lanc-msg', '');
  }
});

// ---------- Produtos ----------

function limparProd() {
  $('form-prod').reset();
  $('prod-id').value = '';
  $('btn-cancelar-prod').hidden = true;
}
$('btn-cancelar-prod').addEventListener('click', () => { limparProd(); msg('prod-msg', ''); });

$('form-prod').addEventListener('submit', async (e) => {
  e.preventDefault();
  const linha = {
    nome: $('prod-nome').value.trim(),
    preco: Number($('prod-preco').value) || 0,
    unidade: $('prod-unidade').value.trim() || 'saco',
    controla_estoque: $('prod-controla').checked,
    estoque_inicial: Number($('prod-estoque').value) || 0,
  };
  const id = $('prod-id').value;
  const { error } = id
    ? await db.from('produtos').update(linha).eq('id', id)
    : await db.from('produtos').insert(linha);
  if (error) { msg('prod-msg', 'Erro: ' + error.message, true); return; }
  limparProd();
  msg('prod-msg', 'Produto salvo!');
  await carregar();
});

$('lista-prod').addEventListener('click', async (e) => {
  const { editarProd, apagarProd } = e.target.dataset;
  if (editarProd) {
    const p = estado.produtos.find((x) => x.id === editarProd);
    $('prod-id').value = p.id;
    $('prod-nome').value = p.nome;
    $('prod-preco').value = p.preco;
    $('prod-unidade').value = p.unidade;
    $('prod-controla').checked = p.controla_estoque;
    $('prod-estoque').value = p.estoque_inicial;
    $('btn-cancelar-prod').hidden = false;
    msg('prod-msg', '');
    window.scrollTo(0, 0);
  } else if (apagarProd) {
    if (estado.lancamentos.some((l) => l.produto_id === apagarProd)) {
      alert('Este produto já tem lançamentos e não pode ser apagado.');
      return;
    }
    if (!confirm('Apagar este produto?')) return;
    const { error } = await db.from('produtos').delete().eq('id', apagarProd);
    if (error) alert('Erro: ' + error.message); else await carregar();
  }
});
