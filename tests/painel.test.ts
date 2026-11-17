// @vitest-environment happy-dom
// Painel visual das telas de busca: barras em ranking, colunas por mês e contagem por classe.
import { describe, it, expect } from 'vitest';
import { barras, porMes, contar, painel } from '../src/componentes';

describe('Painel das telas de busca', () => {
  it('contar agrupa por classe (uma ou várias por item), soma o peso e ordena do maior para o menor', () => {
    const L = [{ c: 'a', v: 1 }, { c: 'b', v: 5 }, { c: ['a', 'b'], v: 2 }, { c: '', v: 9 }];
    expect(contar(L, (x) => x.c)).toEqual([{ rotulo: 'a', valor: 2, dado: 'a' }, { rotulo: 'b', valor: 2, dado: 'b' }]);
    expect(contar(L, (x) => x.c, (x) => x.v).map((b) => [b.rotulo, b.valor])).toEqual([['b', 7], ['a', 3]]);
  });

  it('barras viram botões de filtro quando há atributo, marcam a ativa e escapam o texto', () => {
    const h = barras('Por <classe>', [{ rotulo: 'Contas & cia', valor: 10, dado: 'conta', ativo: true }, { rotulo: 'Zero', valor: 0, dado: 'z' }, { rotulo: 'Negócios', valor: 5, dado: 'neg' }], { attr: 't' });
    const d = document.createElement('div'); d.innerHTML = h;
    expect(d.querySelector('figcaption')?.textContent).toBe('Por <classe>');
    const b = d.querySelectorAll<HTMLButtonElement>('button.pn-l');
    expect(b.length).toBe(2); // valor zero fica de fora
    expect(b[0].dataset.t).toBe('conta');
    expect(b[0].getAttribute('aria-pressed')).toBe('true');
    expect(b[1].querySelector<HTMLElement>('.pn-t i')!.style.width).toBe('50%');
    expect(d.querySelector('.pn-r')?.textContent).toBe('Contas & cia');
  });

  it('barras sem atributo são só leitura e avisam quando não há dados', () => {
    const d = document.createElement('div');
    d.innerHTML = barras('X', [{ rotulo: 'a', valor: 1 }]);
    expect(d.querySelector('button')).toBeNull();
    expect(d.querySelectorAll('li.pn-l').length).toBe(1);
    d.innerHTML = barras('X', [], { vazio: 'Nada aqui.' });
    expect(d.textContent).toContain('Nada aqui.');
  });

  it('porMes mostra os últimos meses em ordem, com o total do período', () => {
    const agora = new Date(), mes = (i: number) => { const x = new Date(agora.getFullYear(), agora.getMonth() - i, 15); return x.toISOString().slice(0, 10); };
    const d = document.createElement('div');
    d.innerHTML = porMes('Sinais', [mes(0), mes(0), mes(2), mes(30)], 6);
    const cols = d.querySelectorAll('.pn-m li');
    expect(cols.length).toBe(6);
    expect(cols[5].querySelector('.pn-v')?.textContent).toBe('2');
    expect(cols[3].querySelector('.pn-v')?.textContent).toBe('1');
    expect(d.querySelector('small')?.textContent).toBe('3 nos últimos 6 meses');
  });

  it('painel junta os blocos e ignora os vazios', () => {
    const d = document.createElement('div');
    d.innerHTML = painel(['<figure class="pn-c"></figure>', ''], 'Resumo');
    expect(d.querySelector('section.pn')?.getAttribute('aria-label')).toBe('Resumo');
    expect(d.querySelectorAll('.pn-c').length).toBe(1);
  });
});
