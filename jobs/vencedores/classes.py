"""Classificação fina dos contratos colhidos: em qual frente da Produceria o objeto cai, e o que é ruído.
Tudo em texto normalizado (minúsculas, sem acento). Ordem de FRENTES = prioridade para a Produceria."""
import re, unicodedata


def norm(s):
    s = unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s.lower())


def rx(*p):
    return re.compile("|".join(p))


# ruído geral: compra de bem, saúde, TI, obra, comida etc. Se casar, sai (a não ser que a frente tenha "forte").
RUIDO = rx(
    r"generos alimenticios", r"alimentac", r"lanche", r"merenda", r"medicament", r"hospitalar",
    r"video ?(laringo|laparo|endo|colono|histero|artro|broncos|cirurg|dermato|nistag)", r"videomonitor", r"video ?monitor", r"cftv", r"cameras? de seguranca",
    r"videoconferencia", r"video ?wall", r"videowall", r"vigilancia", r"limpeza", r"obra", r"pavimenta", r"engenharia", r"construcao civil", r"reforma",
    r"outsourcing", r"impressoras?", r"multifuncion", r"reprografi", r"copiadora", r"toner", r"cartucho", r"suprimentos? (de|para|pra) impress", r"papel a4", r"papel sulfite",
    r"sinalizacao (viaria|horizontal|vertical|semaforic|de transito|rodoviaria|nautica|de obras|hospitalar|de seguranca)", r"semaforo", r"transito",
    r"aquisicao de (livros|acervo|obras literarias|kit)", r"livros? (didatic|literari|paradidatic|infantis)", r"acervo bibliografico", r"assinatura de (revista|jornal|periodic)",
    r"taxa de publicacao", r"artigos? cientific", r"publicacao de (atos|editais|extrato|aviso)", r"publicidade legal", r"diario oficial", r"imprensa oficial",
    r"uniforme", r"fardamento", r"vestuario", r"camiseta", r"bone", r"colete", r"brinde",
    r"banheiros? quimic", r"tendas?", r"gerador", r"gradil", r"grades? de contencao", r"palco", r"trio eletrico", r"fogos de artificio", r"bandas?", r"shows?", r"artistic", r"musico", r"rodeio",
    r"inscricao (de|dos|do|da) servidor", r"inscric(ao|oes) para participacao", r"participacao de .{0,30}servidor", r"congresso", r"seminario", r"inscricoes? em (congresso|curso|evento|seminario)", r"participacao (de servidor|em congresso|em curso|em evento)", r"curso de capacitacao", r"capacitacao", r"treinamento",
    r"passagens?", r"hospedagem", r"locacao de veiculo", r"combustivel", r"seguranca privada",
    r"aquisicao de equipamentos?", r"aquisicao de (cameras?|lentes?|drones?|projetor|televis|tv|monitor|microfone|caixas? de som|notebook|computador)", r"equipamentos? (de informatica|audiovisuais?|tecnologic)",
    r"material de (consumo|expediente|escritorio|limpeza)", r"moveis", r"mobiliario",
    r"carro de som", r"ouvidoria", r"leilao", r"permissao (remunerada )?de uso", r"concessao de uso",
    r"termo de execucao cultural", r"premio", r"premiacao", r"edital de fomento", r"apoio financeiro", r"lei paulo gustavo", r"aldir blanc", r"pnab",
)

FRENTES = [
    {"id": "publicidade", "nome": "Publicidade · agência com conta pública", "craft": 0.9,
     "inc": rx(r"agencias? de (propaganda|publicidade|comunicacao)", r"servicos? de publicidade", r"servicos? publicitari", r"publicidade (institucional|de utilidade publica|e propaganda)",
               r"lei (n[o.]? ?)?12\.?232", r"campanhas? publicitari", r"comunicacao (publicitaria|institucional e publicidade)", r"planejamento,? (conceituacao|criacao|desenvolvimento)"),
     "exc": rx(r"veiculacao (de|em) (jornal|radio|revista|site|portal|blog)", r"insercoes? (em|de) (radio|jornal|tv)", r"jornal impresso", r"divulgacao em (banner digital|portal|site|jornal|radio)", r"spots? em radio", r"anuncio")},
    {"id": "audiovisual", "nome": "Produção audiovisual", "craft": 1.0,
     "inc": rx(r"producao (audiovisual|de videos?|de filmes?|cinematografic|de conteudo audiovisual)", r"servicos? (audiovisua|de filmagem|de video|de producao de video)",
               r"videos? (institucion|educativ|promociona|documenta|curtos|publicitari)", r"filmes? (institucion|publicitari|documenta|educativ)", r"filmagem", r"videografi",
               r"edicao (e finalizacao )?de videos?", r"pos[- ]producao", r"documentari", r"motion ?graphics?", r"animac(ao|oes) (2d|3d|grafica|digital)", r"reels", r"cobertura audiovisual", r"captacao de (imagens|video)"),
     "exc": rx(r"aquisicao", r"locacao de equipamentos")},
    {"id": "transmissao", "nome": "Transmissão ao vivo e streaming", "craft": 0.75,
     "inc": rx(r"transmiss(ao|oes) (ao vivo|online|on-line|em tempo real|via internet|das sessoes|de sessoes|de eventos|simultanea)", r"streaming", r"live stream", r"webinar", r"lives?\b"),
     "exc": rx(r"transmissao de dados", r"link de dados", r"radio ?enlace", r"rede de transmissao", r"internet dedicada", r"energia", r"microfones", r"sonorizacao", r"iluminacao cenica", r"paineis de led")},
    {"id": "fotografia", "nome": "Fotografia e cobertura de imagem", "craft": 0.85,
     "inc": rx(r"cobertura fotografic", r"servicos? fotografic", r"registro fotografic", r"fotografia (institucional|profissional|de eventos|publicitaria)", r"ensaio fotografic", r"servicos? de fotografi", r"banco de imagens", r"fotografo"),
     "exc": rx(r"papel fotografico", r"aerofotogramet", r"fotografia aerea", r"radiolog", r"documento de identidade", r"foto 3x4")},
    {"id": "conteudo", "nome": "Conteúdo, redes sociais e comunicação digital", "craft": 0.8,
     "inc": rx(r"producao de conteudo", r"conteudos? digita", r"gestao (de|das) (redes|midias) sociais", r"redes sociais", r"midias sociais", r"marketing digital", r"comunicacao digital", r"social media", r"influenciador"),
     "exc": rx(r"anuncio", r"impulsionamento$", r"plataforma", r"biblioteca", r"livros?", r"e-?books?", r"assinatura", r"acesso a")},
    {"id": "cenografia", "nome": "Cenografia, expografia e ambientação", "craft": 0.9,
     "inc": rx(r"cenografi", r"cenografic", r"expografi", r"museografi", r"montagem de exposic", r"instalac(ao|oes) artistic", r"ambientacao", r"direcao de arte", r"exposicao (itinerante|museologica|de longa duracao|temporaria|permanente)"),
     "exc": rx(r"agropecuar", r"natalin")},
    {"id": "design", "nome": "Design, identidade visual e editorial", "craft": 0.75,
     "inc": rx(r"identidade visual", r"design grafico", r"programacao visual", r"projeto grafico", r"diagramacao", r"criacao (de|das) (artes?|pecas|layout|marca)", r"producao editorial", r"servicos? editoria", r"arte[- ]final"),
     "exc": rx(r"impressao", r"agenda", r"livros?", r"apostila", r"plotagem")},
    {"id": "audio", "nome": "Áudio: locução, jingle, trilha, podcast", "craft": 0.8,
     "inc": rx(r"locucao", r"jingle", r"trilha sonora", r"podcast", r"producao de (audio|spots?)", r"gravacao de (spots?|audio|jingle|vinheta)", r"vinhetas?", r"mixagem"),
     "exc": rx(r"carro de som", r"radio comunitaria")},
    {"id": "eventos", "nome": "Organização e produção de eventos", "craft": 0.55,
     "inc": rx(r"organizacao (e (producao|realizacao) )?de eventos?", r"producao (e organizacao )?de eventos?", r"realizacao de eventos?", r"planejamento,? organizacao", r"montagem (e desmontagem )?de (estandes?|stands?)", r"\bestandes?\b", r"\bstands?\b", r"cerimonial", r"gestao de eventos"),
     "exc": rx()},
    {"id": "ooh", "nome": "Mídia exterior e DOOH", "craft": 0.5,
     "inc": rx(r"midia exterior", r"\boutdoors?\b", r"front ?light", r"back ?light", r"\bdooh\b", r"midia (digital )?indoor", r"paineis? (de led|eletronico) (para|de) (publicidade|divulgacao|midia)", r"relogios? digitais?"),
     "exc": rx(r"superficie", r"academia", r"piso", r"mobiliario", r"aquisicao")},
    {"id": "grafica", "nome": "Produção gráfica e impressos", "craft": 0.3,
     "inc": rx(r"servicos? grafic", r"materia(l|is) grafic", r"impressao (grafica|offset|digital|de materia|de folder|de cartilha|de livro|de revista|de banner|de impresso)", r"confeccao (e impressao )?de (impressos?|folders?|cartilhas?|banners?|cartazes?|panfletos?|livretos?)", r"impressos", r"\bfolders?\b", r"cartilhas?", r"\bbanners?\b", r"cartazes", r"panfletos?"),
     "exc": rx()},
    {"id": "comvisual", "nome": "Comunicação visual e sinalização", "craft": 0.3,
     "inc": rx(r"comunicacao visual", r"sinalizacao (visual|interna|predial|institucional|de ambientes|indicativa)", r"\btotens?\b", r"letreiros?", r"adesivac", r"plotagem", r"backdrops?", r"fachadas? (em acm|luminos|de identificacao)"),
     "exc": rx()},
]


# ruído que derruba sempre, mesmo em frente forte
DURO = rx(r"publicidade legal", r"streaming de (livros|musica|filmes)", r"aquisicao de:", r"\btv led\b", r"radiofonic", r"emissoras? de radio", r"videocirurg", r"materia(l|is) (medic|hospitalar)", r"aquisic(ao|oes) de (\(?\d+\)? |um |uma )?\(?(camera|cameras|equipamento|equipamentos|aparelho|aparelhos|kit|kits|material|materiais|itens)", r"fornecimento de (material|materiais|equipamentos?)", r"locacao de equipamentos?", r"provas? de concurso", r"inscric(ao|oes) d[eo]s? .{0,40}(servidor|curso)", r"\bcantora?\b", r"dupla sertaneja", r"representante exclusiv", r"apresentac(ao|oes) artistic", r"freepik|shutterstock|adobe stock|getty images|banco de imagens", r"\blibras\b", r"interpretacao e traducao", r"big data", r"social listening", r"monitoramento (e analise )?(de|das) (redes|midias)", r"veiculacao de jornais", r"jornais impressos", r"divulgacao de editais", r"publicidade volante", r"servicos? de engenharia", r"inventario", r"publicac(ao|oes) (de|das) (materias|atos|editais|avisos|extratos)", r"materias oficiais", r"diario oficial", r"imprensa oficial", r"jornais? de grande circulacao",
          r"licencas? (de|do|dos) (uso de )?softwares?", r"drenagem", r"galerias? pluvia", r"tubulac", r"esgoto", r"video ?inspec", r"video ?monitor", r"atendimento ao publico", r"call ?center", r"palestrante", r"\bpalestras?\b", r"formac(ao|oes) (de|continuada)", r"livros? didatic", r"biblioteca digital", r"solucao editorial", r"materia(l|is) (didatic|pedagogic|bibliografic)", r"votacao eletronica", r"concurso publico", r"processo seletivo", r"vestibular", r"apostila", r"\bsoftwares?\b", r"data ?center", r"adobe", r"facilities", r"coffee ?break", r"buffet", r"tecnologia da informacao")


# escopo de 10/11/2026: eventos saem; gráfica, comunicação visual e mídia exterior são núcleo e ficam.
# Rígidas valem no assunto principal (início do objeto); brandas cedem só a um serviço de craft citado antes.
ASSUNTO = 240
RIGIDAS = [
    ("eventos (fora do escopo)", rx(r"(organizacao|producao|realizacao|gestao|execucao) (e (producao|realizacao|execucao) )?de eventos", r"organizacao, producao e realizacao",
                                    r"montagem de eventos?", r"(montagem|desmontagem|locacao|cota) de (estandes?|stands?)", r"(estandes?|stands?) (institucional|de feira|em feira|no evento)",
                                    r"cerimonial", r"locacao de (um )?espaco de \d+", r"promotora (exclusiva )?do evento")),
    ("curso, palestra ou inscrição", rx(r"\binscric", r"\bcursos?\b", r"capacitac", r"palestra", r"webinari", r"docencia", r"mentoria", r"workshop", r"treinamento")),
    ("software ou licença", rx(r"\blicencas?\b", r"software", r"\bsaas\b", r"subscric", r"hardware", r"solucao em nuvem", r"sistemas? (aplicativos?|de informatica|informatizad|de gestao)", r"rastreabilidade", r"virtualizacao")),
    ("compra de equipamento", rx(r"aquisic(ao|oes) (e instalacao )?de (\(?\d+\)? |um |uma )?\(?(equipamentos?|cameras?|filmadoras?|lentes?|drones?|projetor|televis|tvs?\b|monitor|microfones?|notebooks?|computador|paineis de led|painel de led|totens? de led|veiculos?)",
                                 r"aquisic(ao|oes) de .{0,25}(cameras?|filmadoras?|computador|equipamentos?)", r"fornecimento de equipamentos?")),
    ("obra e engenharia", rx(r"engenharia", r"construc", r"reforma\b", r"pavimenta", r"(?<!mao de )\bobras? (de|civil|civis)\b")),
    ("fora do ramo", rx(r"fornecimento de alimentacao", r"alimentacao e bebida", r"refeic", r"coffee", r"buffet", r"merenda", r"\bseguros?\b", r"apolice", r"radiodifus", r"emissoras?\b",
                        r"\bradios?\b (fm|am|comunitar)", r"libras", r"inventario", r"contab", r"limpeza", r"vigilancia", r"\bcarnes?\b", r"boletos?", r"dados variaveis", r"faturamento",
                        r"cartoes? (pre-?impressos|de pvc|pvc)", r"certificado digital", r"\bchips?\b", r"fantasias", r"servicos postais", r"correios",
                        r"redes? (lan|wlan)", r"papeis? (couche|sulfite|a4|offset)", r"bolsas? termica", r"mochilas?", r"cedulas? de identidade", r"\btapetes?\b", r"automove", r"ca(mi)?nhonete", r"camionete", r"telefon", r"celular", r"sacolas", r"moda feminina", r"levantamento cadastral", r"hospedagem (e manutencao )?de sites?",
                        r"manutencao e reparos?", r"provas (escolares|de avaliacao)", r"direitos? de exibicao", r"empresa jornalistica", r"imprensa escrita", r"materia(l|is) permanentes?",
                        r"publicidade (institucional )?legal")),
]
BRANDAS = [
    ("shows e festas", rx(r"\bshows?\b", r"\bbandas?\b", r"apresentac(ao|oes) (artistica|musica)", r"animacao (musical|de bailes|do publico|de festa)", r"recreac", r"\bdj\b", r"torneio", r"futsal", r"\bcaches?\b", r"atrac(ao|oes) (principal|musica|local|artistic)")),
    ("decoração e Natal", rx(r"ornament", r"decorac", r"natal", r"papai noel", r"iluminacao decorativa")),
    ("locação de som, luz, palco ou estrutura", rx(r"sonorizac", r"\bpalco", r"iluminacao (cenica|de palco)", r"tendas?\b", r"geradores?", r"locacao de (equipamentos?|estruturas?|som)", r"som e luz", r"sistemas? de som", r"estruturas? (metalica|de palco|modula|para evento|temporaria)", r"trio eletrico")),
    ("veiculação em jornal, rádio ou site", rx(r"veiculac(ao|oes) (de|em) (jornal|jornais|radio|materias|site|portal|blog|revista|tv|programa)", r"publicac(ao|oes) de materias", r"credenciamento de (radios|emissoras|veiculos de comunicacao|jornais|sites|portais)",
                                              r"jornal impresso", r"\bspots? em radio", r"insercoes? (em|de) (radio|jornal|tv)")),
    ("assessoria de imprensa", rx(r"assessoria de imprensa", r"relacoes publicas")),
]
FORTES = ("audiovisual", "fotografia", "transmissao")


def ruido(t, frentes):
    """motivo do ruído no objeto normalizado t, ou None. frentes = ids das frentes que casaram, em ordem."""
    principal = t[:ASSUNTO]
    pos_forte = min([m.start() for f in FRENTES if f["id"] in FORTES and f["id"] in frentes for m in [f["inc"].search(t)] if m] or [len(t)])
    for nome, r in RIGIDAS:
        m = r.search(principal)
        if m and not (nome.startswith("curso") and pos_forte < m.start()):  # "filmagem do encontro de capacitação" fica
            return nome
    for nome, r in BRANDAS:
        m = r.search(t)
        if m and m.start() <= pos_forte:
            if nome.startswith("locação") and "ooh" in frentes and re.search(r"midia exterior|outdoors? (publicit|de divulgac)|espaco publicitario|publicid|divulgac", t):
                continue  # painel de LED de mídia exterior é núcleo
            if nome.startswith("locação") and "comvisual" in frentes and re.search(r"fachada|letreiro|\btotens?\b|\bacm\b|comunicacao visual", t):
                continue  # estrutura de fachada, letreiro ou totem é comunicação visual
            return nome
    return None


VEICULO = rx(r"\bradios?\b", r"\bfm\b", r"emissoras?", r"radiodifus", r"\bjornal\b", r"jornais", r"\btv\b", r"televisao", r"\bportal\b", r"\bnoticias\b", r"\bblog\b", r"\brevista\b")


def fornecedor_e_veiculo(nome, frente):
    """rádio, jornal, TV ou portal que vende espaço de veiculação: não é cliente nem concorrente do hub"""
    return frente in ("publicidade", "conteudo", "audio") and bool(VEICULO.search(norm(nome)))


def classificar(objeto, compl=""):
    t = norm(f"{objeto} {compl}")
    if DURO.search(t):
        return None, []
    achou = []
    for f in FRENTES:
        if f["inc"].search(t) and not (f["exc"].pattern and f["exc"].search(t)):
            achou.append(f)
    if not achou or achou[0]["id"] == "eventos":
        return None, []
    if ruido(norm(objeto), [f["id"] for f in achou]):
        return None, []
    # ruído só derruba quando a frente principal não é inequívoca (publicidade/audiovisual/cenografia/fotografia são fortes)
    forte = achou[0]["id"] in ("publicidade", "audiovisual", "cenografia", "fotografia", "transmissao", "conteudo", "design")
    if RUIDO.search(t) and not forte:
        return None, []
    if RUIDO.search(t) and forte:
        # forte mas com ruído: exige que o ruído não seja compra de bem/saúde
        if re.search(r"aquisicao de (equipamento|camera|lente|drone|projetor|tv|televis|monitor|microfone)|generos alimenticios|medicament|video ?(laringo|laparo|endo|colono)|videomonitor|cftv|videoconferencia|equipamentos? audiovisua", t):
            return None, []
    return achou[0], [f["id"] for f in achou[1:3]]


def tipo_empresa(nome):
    n = norm(nome)
    if re.search(r"fundac|instituto|universidade|associac|cooperativ|companhia editora|servico social|sao paulo turismo|spturis|empresa (municipal|publica|estadual)|companhia (municipal|estadual)|\bsesc\b|\bsenac\b|\bsebrae\b|empresa brasil de comunicacao|\bebc\b|prodesp|imprensa oficial|camara|prefeitura|secretaria|consorcio publico", n):
        return "Entidade ou empresa pública"
    if re.search(r"propaganda|publicidade|publicitari|comunicac|marketing|agencia|\bcom\b|criacao|criativ|\bads\b|branding|mkt", n):
        return "Agência / comunicação"
    if re.search(r"produc|produtora|filmes?|audiovisua|video|cine|studio|estudio|imagem|imagens|foto|midia|media|content|conteudo|tv\b|animac", n):
        return "Produtora / estúdio"
    if re.search(r"eventos?|promoc|cenograf|estandes?|stands?|feiras?|cerimonial|shows?", n):
        return "Eventos / cenografia"
    if re.search(r"grafica|graficos|editora|impress|print|offset|serigraf|copias|papel", n):
        return "Gráfica / editora"
    if re.search(r"visual|sinaliz|letreiro|placas|adesiv|plot|acm", n):
        return "Comunicação visual"
    return "Outros / generalista"


MEI = re.compile(r"^\s*\d{2}\.?\d{3}\.?\d{3}\s")
