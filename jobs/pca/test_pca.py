"""Testes do coletor de PCA, sem rede (buscar falso)."""
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pca  # noqa: E402

PERFIL = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cerebro", "perfil.json"), encoding="utf-8"))
C = pca.cb.Cerebro(PERFIL)


def reg(cnpj="11111111000111", uni="100", ano=2027, itens=()):
    return {"orgaoEntidadeCnpj": cnpj, "orgaoEntidadeRazaoSocial": "PREFEITURA DE EXEMPLO", "codigoUnidade": uni,
            "nomeUnidade": "SECRETARIA DE COMUNICAÃ‡ÃƒO", "anoPca": ano, "idPcaPncp": f"{cnpj}-0-1/{ano}",
            "dataAtualizacaoGlobalPCA": "2026-11-01T10:00:00", "itens": list(itens)}


def item(n, desc, classe="9614", valor=1000.0):
    return {"numeroItem": n, "descricaoItem": desc, "classificacaoSuperiorCodigo": classe, "valorTotal": valor,
            "quantidadeEstimada": 1, "unidadeFornecimento": "serviço", "dataDesejada": "2027-03-01"}


class TestPca(unittest.TestCase):
    def test_filtro_segue_o_escopo_do_cerebro(self):
        r = reg(itens=[item(1, "PRODUÇÃO DE VIDEO INSTITUCIONAL COMPLETA"), item(2, "SONORIZAÇÃO"), item(3, "FILMAGEM AÉREA", "8381"), item(4, "")])
        achados = pca.itens_no_escopo(r, "9614", C)
        self.assertEqual([a["numero"] for a in achados], [1])
        self.assertEqual(achados[0]["frente"], "Produção audiovisual e filmes")

    def test_agrupa_por_orgao_e_ano_sem_repetir(self):
        r1 = reg(itens=[item(1, "PRODUÇÃO DE VIDEO INSTITUCIONAL", valor=5000)])
        r2 = {**reg(uni="200"), "nomeUnidade": "GABINETE DO PREFEITO"}
        r3 = reg(cnpj="22222222000122")
        i1 = pca.itens_no_escopo(r1, "9614", C)[0]
        docs = pca.agrupar([(r1, i1), (r1, i1), (r2, {**i1, "numero": 9, "valor": 100}), (r3, i1)])
        self.assertEqual(len(docs), 2)
        d = docs[pca.doc_id("11111111000111", 2027)]
        self.assertEqual([x["numero"] for x in d["itens"]], [1, 9])
        self.assertEqual(d["total"], 5100)
        self.assertEqual(d["unidades"], ["Secretaria De Comunicação", "Gabinete Do Prefeito"])
        self.assertEqual(d["itens"][1]["unidade"], "Gabinete Do Prefeito")
        self.assertEqual(d["primeiraData"], "2027-03-01")

    def test_paginas_e_local(self):
        respostas = {1: {"data": [reg()], "paginasRestantes": 1}, 2: {"data": [reg(uni="2")], "paginasRestantes": 0}}
        def buscar(url):
            if "/pca/" in url:
                return respostas[int(url.split("pagina=")[1].split("&")[0])]
            return {"municipio": {"nome": "CAMPINAS", "uf": {"siglaUF": "SP"}}, "orgao": {"esferaId": "M"}}
        self.assertEqual(len(list(pca.paginas_pca(2027, "9614", 10, buscar, pausa=0))), 2)
        docs = {"x": {"cnpj": "1", "codigoUnidade": "2"}}
        pca.completar_local(docs, buscar)
        self.assertEqual((docs["x"]["uf"], docs["x"]["municipio"], docs["x"]["esfera"]), ("SP", "Campinas", "Municipal"))

    def test_lotes_para_o_artifactdata(self):
        r = reg(itens=[item(1, "PRODUÇÃO DE VIDEO INSTITUCIONAL")])
        docs = pca.agrupar([(r, pca.itens_no_escopo(r, "9614", C)[0])])
        with tempfile.TemporaryDirectory() as t:
            self.assertEqual(pca.gravar(t, docs, "2026-11-11T10:00:00-03:00"), 1)
            lote = json.load(open(os.path.join(t, "lote_01.json")))
            self.assertEqual(lote[0]["collection"], "pca")
            self.assertTrue(os.path.exists(lote[0]["file_path"]))

    def test_anos_padrao(self):
        from datetime import date
        self.assertEqual(pca.anos_padrao(date(2026, 11, 11)), [2027])
        self.assertEqual(pca.anos_padrao(date(2027, 3, 1)), [2028, 2027])


if __name__ == "__main__":
    unittest.main()
