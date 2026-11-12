"""Casos reais do radar que fixam o critério do perfil (rode: python3 -m unittest discover jobs/cerebro)."""
import json
import os
import unittest
from datetime import date

from cerebro import Cerebro

AQUI = os.path.dirname(os.path.abspath(__file__))
CB = Cerebro(json.load(open(os.path.join(AQUI, "perfil.json"), encoding="utf-8")))
HOJE = date(2026, 11, 10)


def nota(objeto, valor=100000, uf="SP", srp=False):
    return CB.pontuar(objeto, valor, "2026-11-30", "Pregão - Eletrônico", srp, HOJE, uf)


class Porta(unittest.TestCase):
    def test_objeto_sem_trabalho_do_hub_nao_entra(self):
        self.assertIsNone(nota("SERVIÇOS"))
        self.assertIsNone(nota("Contratação de banda musical para animação do baile da terceira idade"))
        n = nota("Seguro da caminhonete L200 Triton Outdoor")
        self.assertTrue(n is None or n["score"] == 0)

    def test_nucleo_entra_com_nota_alta(self):
        n = nota("Contratação de empresa especializada em produção audiovisual, para criação, captação, edição e finalização de vídeos")
        self.assertEqual(n["frente"], "Produção audiovisual e filmes")
        self.assertGreaterEqual(n["score"], 85)
        self.assertEqual(n["aderencia"], "direta")
        n = nota("Prestação de serviço contínuo de transmissão ao vivo das sessões ordinárias da Câmara")
        self.assertEqual(n["frente"], "Transmissão ao vivo")
        self.assertGreater(n["score"], 60)


class Exclusoes(unittest.TestCase):
    def fora(self, objeto, motivo):
        n = nota(objeto)
        self.assertIsNotNone(n, objeto)
        self.assertEqual(n["score"], 0, objeto)
        self.assertIn(motivo, n["fora"])

    def test_rigidas(self):
        self.fora("Contratação de assinatura da ferramenta de edição de vídeos (CAPCUT) por 12 meses", "software")
        self.fora("Inscrição de servidor no curso Redes Sociais Aplicadas ao Poder Público: produção de conteúdo, vídeos e fotos", "curso")
        self.fora("Contratação de agência de propaganda para serviços de publicidade e comunicação institucional", "agência")
        self.fora("Contratação de ferramentas gráficas e audiovisuais para otimizar a produção de conteúdo multimídia", "software")
        self.fora("Prestação de serviços de buffet, coffee break e serviços de fotografia profissional", "fora do ramo")

    def test_rigida_so_vale_no_assunto_principal(self):
        n = nota("Contratação de pessoa jurídica especializada para prestação de serviços continuados de transmissão ao vivo e "
                 "produção audiovisual, destinados ao atendimento das atividades legislativas e institucionais da câmara "
                 "municipal, compreendendo a captação de imagens, edição, operação de câmeras, mesa de corte, gerador de "
                 "caracteres e intérprete de Libras nas sessões")
        self.assertGreater(n["score"], 0)

    def test_branda_cai_sem_porta_forte(self):
        self.fora("Prestação de serviços de ornamentação e cenografia natalina", "decoração")
        self.fora("Confecção e fornecimento de estrutura cenográfica", "estrutura")

    def test_branda_cede_quando_o_servico_vem_antes(self):
        n = nota("Serviço de filmagem e transmissão ao vivo via YouTube da chegada do Papai Noel")
        self.assertGreater(n["score"], 0)
        self.assertIn("atenção", n["motivo"])
        self.fora("Serviços de painel de LED e filmagem aérea com veículo não tripulado", "LED")


class ComunicacaoVisualEOOH(unittest.TestCase):
    def test_comunicacao_visual_entra(self):
        for obj in ("Confecção e instalação de letreiros e totens de identificação em ACM para as unidades de saúde",
                    "Prestação de serviços de comunicação visual com fornecimento e instalação de adesivos e placas de identificação",
                    "Contratação de empresa para sinalização interna e wayfinding do novo prédio do fórum"):
            n = nota(obj)
            self.assertEqual(n["frente"], "Comunicação visual e sinalização", obj)
            self.assertGreater(n["score"], 0, obj)

    def test_ooh_entra(self):
        for obj in ("Locação de outdoors e minidoors para divulgação de campanhas institucionais",
                    "Contratação de empresa para veiculação de campanha em mídia exterior (front light, backlight e empenas)"):
            n = nota(obj)
            self.assertEqual(n["frente"], "Mídia exterior OOH/DOOH", obj)
            self.assertGreater(n["score"], 0, obj)

    def test_ruido_de_placa_e_impresso_sai(self):
        n = nota("Serviços de sinalização viária horizontal e vertical com placas de regulamentação")
        self.assertTrue(n is None or n["score"] == 0)
        self.assertIsNone(nota("Registro de preços para serviços gráficos: impressão de folders, cartilhas e banners"))
        n = nota("Locação de painel de LED, som e iluminação para o show de aniversário da cidade")
        self.assertTrue(n is None or n["score"] == 0)


class Nota(unittest.TestCase):
    OBJ = "Prestação de serviços de cobertura fotográfica e filmagem de eventos institucionais"

    def test_presencial_pequeno_longe_de_sp_perde_pontos(self):
        self.assertLess(nota(self.OBJ, 3000, "GO")["score"], nota(self.OBJ, 3000, "SP")["score"])
        self.assertEqual(nota(self.OBJ, 300000, "GO")["score"], nota(self.OBJ, 300000, "SP")["score"])

    def test_valor_acima_do_porte_alerta(self):
        n = nota(self.OBJ, 20000000)
        self.assertIn("acima do porte", n["motivo"])
        self.assertLess(n["score"], nota(self.OBJ, 300000)["score"])

    def test_extremos_de_valor_ficam_abaixo_da_triagem(self):
        self.assertLess(nota(self.OBJ, 1000)["score"], 60)
        self.assertLess(nota("Contratação de empresa de comunicação digital e produção de conteúdo", 80000000)["score"], 60)
        self.assertGreaterEqual(nota(self.OBJ, 300000)["score"], 60)

    def test_frente_sem_cnae_e_condicionada(self):
        n = nota("Concepção artística e direção criativa da expografia do museu municipal")
        self.assertEqual(n["frente"], "Direção de arte e cenografia")
        self.assertEqual(n["aderencia"], "condicionada")
        self.assertIn("CNAE", n["motivo"])


class FalsosPositivos(unittest.TestCase):
    """Casos reais de 12/11/2026 que entravam no radar sem ser trabalho do hub."""
    def zero(self, objeto):
        n = nota(objeto)
        self.assertTrue(n is None or n["score"] == 0, objeto)

    def test_saem(self):
        for obj in ("Televisão Smart 65 polegadas (TV) Televisão Smart com tela mínima de 65 polegadas, com conteúdos digitais",
                    "Prestação de serviços de ativação e disponibilização de plano de comunicação e rastreamento satelital para equipamentos SPOT X",
                    "Registro de preços visando à contratação de solução de comunicação digital, abrangendo plataforma de mensagens, atendimento multicanal ao cidadão",
                    "Fornecimento de solução integrada de implementação e monitoramento de sinal ISDB-Tb, incluindo controle de loudness, gravação e gestão de conteúdo audiovisual",
                    "Prestação de serviços de propaganda volante por meio de carro de som, destinados à divulgação de campanhas educativas",
                    "Contratação de empresas de Rádio FM e Emissoras de TV para prestação de serviços de comunicação, mediante transmissão ao vivo da Temporada de Verão",
                    "Implantação integral do espetáculo temporário na Lagoa do Parque, incluindo produção audiovisual",
                    "Preparação de originais (revisão e padronização) e revisão de provas diagramadas; elaboração de projeto gráfico",
                    "Locação de Painéis e Totens de LED (indoor e outdoor), incluindo infraestrutura de processamento de vídeo",
                    "Fornecimento e instalação de policarbonato, vidros, acm, brise e placa cimentícia nas unidades",
                    "Mapeamento georreferenciado, vetorização, cadastramento digital, fornecimento e instalação de placas de identificação",
                    "- KIT DE FOTOGRAFIA PROFISSIONAL",
                    "Credenciamento de prestadoras de serviços de comunicação institucional por meio da veiculação de spots de até 60 segundos em emissoras de rádio AM e/ou FM"):
            self.zero(obj)

    def test_misto_com_servico_do_hub_fica(self):
        for obj in ("Prestação de serviços de cobertura fotográfica e cronometragem de corridas de rua",
                    "Prestação de serviços de gravação de spots e propaganda volante",
                    "Prestação de serviços de produção de áudio (spot institucional) e divulgação via propaganda volante (carro de som)"):
            self.assertGreater(nota(obj)["score"], 0, obj)


class GraficaComComunicacaoVisual(unittest.TestCase):
    def test_fica_com_alerta_e_nota_menor(self):
        misto = nota("Registro de preços para serviços gráficos e de comunicação visual, compreendendo a confecção e impressão de materiais")
        puro = nota("Registro de preços para serviços de comunicação visual, compreendendo a confecção e instalação de placas e letreiros")
        self.assertGreater(misto["score"], 0)
        self.assertIn("atenção: o objeto também envolve gráfica em massa", misto["motivo"])
        self.assertLess(misto["score"], puro["score"])
        self.assertEqual(misto["aderencia"], "condicionada")


if __name__ == "__main__":
    unittest.main()
