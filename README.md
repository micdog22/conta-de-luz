# Conta de Luz — descubra quanto cada aparelho pesa na sua conta (HTML + JS)

Monte a lista de aparelhos da sua casa e veja quantos kWh cada um gasta por mês, quanto isso custa em reais e quais são os vilões da conta de luz. Tem uma lista de aparelhos comuns para começar rápido, dicas práticas de economia e exportação em CSV para abrir na planilha.

**Acesse online:** https://micdog22.github.io/conta-de-luz/

## Recursos
- Cada aparelho pode ser informado pela **potência em watts** e o tempo de uso, ou direto pelo **consumo em kWh/mês** (como na etiqueta de geladeiras e freezers).
- Tempo por dia em horas e minutos (`0:40`, `1h30`, `40min` ou `2`), dias de uso por mês e quantidade.
- kWh e R$ por mês de cada aparelho, total da lista e **ranking com barras** mostrando quanto cada um pesa no total.
- Tarifa em R$/kWh e adicional opcional da bandeira tarifária (R$ por 100 kWh).
- Lista de 22 aparelhos comuns com valores aproximados, como chuveiro elétrico, ar-condicionado, geladeira, air fryer e PC gamer.
- Exportação em CSV com ponto e vírgula e vírgula decimal (abre direto no Excel e no LibreOffice em português).
- A lista e a tarifa ficam salvas no navegador (localStorage).

## Como usar
1. Informe a tarifa. Para ter a **tarifa efetiva com impostos**, divida o valor total da sua conta pelo consumo em kWh do mês (os dois aparecem na conta). Exemplo: R$ 230,00 ÷ 250 kWh = R$ 0,92 por kWh.
2. Se quiser simular uma bandeira tarifária, informe o adicional em R$ por 100 kWh. Os valores das bandeiras mudam, por isso não vêm prontos: confira na conta ou no site da distribuidora. Se a sua tarifa efetiva já veio de uma conta com bandeira, deixe 0.
3. Adicione os aparelhos da lista ou cadastre outros, ajustando potência, tempo de uso, dias e quantidade.
4. Veja o ranking e, se quiser, exporte o CSV.

Os valores da lista de aparelhos são aproximados: confira sempre a etiqueta do seu aparelho.

## Como rodar localmente
Módulos ES não carregam via `file://`, então sirva a pasta com qualquer servidor estático:

```bash
python3 -m http.server 8000
```

e abra http://localhost:8000.

## Testes
```bash
npm test
```
(usa só o `node:test`, sem dependências; precisa do Node 18 ou mais novo)

## Como funciona
- **Pela potência:** kWh por mês = potência (W) × horas de uso por dia × dias de uso no mês × quantidade ÷ 1000. Um chuveiro de 5500 W ligado 40 minutos por dia, 30 dias: 5500 × (40 ÷ 60) × 30 ÷ 1000 = 110 kWh.
- **Pelo consumo mensal:** kWh por mês = consumo da etiqueta × quantidade.
- **Custo:** kWh × (tarifa + adicional da bandeira ÷ 100).
- O peso de cada aparelho é a parte dele no total de kWh da lista.

Os cálculos são estimativas: o consumo real depende do aparelho, do uso e da temperatura, e a conta de verdade pode ter outros itens, como a contribuição de iluminação pública.

## Contribuindo
Issues e pull requests são bem-vindos.

## Licença
MIT — veja [LICENSE](LICENSE).
