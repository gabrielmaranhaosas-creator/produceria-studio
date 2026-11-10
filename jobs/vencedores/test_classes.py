"""Casos reais do mapa de vencedores (rode: python3 -m unittest discover -s jobs/vencedores -p 'test_*.py')."""
import unittest

from classes import classificar, fornecedor_e_veiculo


def frente(objeto):
    f, _ = classificar(objeto)
    return f["id"] if f else None


class Escopo(unittest.TestCase):
    def test_nucleo_grafico_e_visual_fica(self):
        self.assertEqual(frente("Registro de preços para contratação de empresa especializada em serviços gráficos"), "grafica")
        self.assertEqual(frente("Contratação de empresa para confecção e instalação de letreiros e totens de comunicação visual"), "comvisual")
        self.assertEqual(frente("Contratação de empresa especializada em comunicação visual para implantação de fachada em ACM com estrutura metálica"), "comvisual")
        self.assertEqual(frente("Locação de outdoor para divulgação da campanha institucional"), "ooh")

    def test_craft_fica(self):
        self.assertEqual(frente("Serviços de filmagem para registro audiovisual do encontro de capacitação da Defensoria"), "audiovisual")
        self.assertEqual(frente("Prestação de serviços de produção audiovisual institucional"), "audiovisual")

    def test_eventos_saem(self):
        self.assertIsNone(frente("Prestação de serviços de organização de eventos, abrangendo planejamento e execução"))
        self.assertIsNone(frente("Contratação do serviço de locação de estande com espaço personalizado"))

    def test_ruido_sai(self):
        self.assertIsNone(frente("Contratação de assinatura de licença de software de edição de vídeos"))
        self.assertIsNone(frente("Contratação de empresa para fornecimento de ornamentação natalina e cenografia"))
        self.assertIsNone(frente("Serviços de sonorização, iluminação e locação de estruturas, palco e filmagem"))
        self.assertIsNone(frente("Contratação de empresas prestadoras de serviços de divulgação em jornal impresso"))
        self.assertIsNone(frente("Locação de automóvel tipo camionete Triton Outdoor para transporte de alunos"))

    def test_veiculo_de_midia(self):
        self.assertTrue(fornecedor_e_veiculo("RADIO CONCORDIA FM LTDA", "publicidade"))
        self.assertFalse(fornecedor_e_veiculo("DMC PROPAGANDA LTDA", "publicidade"))
        self.assertFalse(fornecedor_e_veiculo("GRAFICA JORNAL LTDA", "grafica"))


if __name__ == "__main__":
    unittest.main()
