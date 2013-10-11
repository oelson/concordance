#-*- coding: utf-8 -*-

__all__ = ["XMLittreParser"]

import xml.etree.ElementTree as ET

class XMLittreParser:
    """
    Un parseur du dictionnaire XMLittré.
    """
    
    _ET_parsers = {}

    def __init__(self, xml_directory):
        self._xml_directory = xml_directory
    
    def load_xml_file(self, letter):
        """
        Le dictionnaire est subdivisé en 26 fichiers xml, nommés d'après les
        lettres de l'alphabet.
        Instancie un noeud Element à partir du contenu du fichier correspondant
        à la lettre et le range dans un dictionnaire.
        """
        if not isinstance(letter, str) or not len(letter) == 1:
            raise ValueError("need a letter from the alphabet")
        xml_path = "{}/{}.xml".format(
            self._xml_directory,
            letter
        )
        with open(xml_path, 'r') as xml_file:
            xml_content = xml_file.read()
            self._ET_parsers[letter] = ET.fromstring(xml_content)
    
    def get_parser(self, letter):
        """
        Obtient (éventuellement en l'instanciant à la volée) le bon parseur en
        fonction d'une lettre de l'alphabet.
        """
        letter = letter.lower()
        if letter not in self._ET_parsers:
            self.load_xml_file(letter)
        return self._ET_parsers[letter]
    
    def get_entree(self, name):
        """
        Récupère un noeud Element correspondant au mot recherché.
        Retourne une instance de la classe "XMLittreEntree".
        """
        # récupère le parseur adéquat
        name = name.upper()
        letter = name[0]
        p = self.get_parser(letter)
        entree = p.find("./entree[@terme='{}']".format(name))
        if entree is None:
            raise AttributeError("l'entrée \"{}\" n'existe pas".format(name))
        return XMLittreEntree(name, entree)

class XMLittreEntree:
    """
    Une entrée du dictionnaire générée par le parseur XMLittreParser.
    Une entrée correspond à une définition.
    """

    entete = None
    prononciation = None
    nature = None
    corps = None
    variantes = []
    historique = None
    historiques = []
    remarque = None
    remarques = []

    def __init__(self, mot, entree):
        self.mot = mot
        self.entree = entree

    def get_entete(self):
        if self.entete is None:
            self.entete = self.entree.find("./entete")
        return self.entete
    
    def get_prononciation(self):
        if self.prononciation is None:
            entete = self.get_entete()
            if entete is not None:
                self.prononciation = entete.find("./prononciation").text
        return self.prononciation
    
    def get_nature(self):
        if self.nature is None:
            entete = self.get_entete()
            if entete is not None:
                self.nature = entete.find("./nature").text
        return self.nature
    
    def get_corps(self):
        if self.corps is None:
            self.corps = self.entree.find("./corps")
        return self.corps
        
    def get_variantes(self):
        if not self.variantes:
            corps = self.get_corps()
            if corps is not None:
                for v in corps.findall("./variante"):
                    variante = {
                        "num": int(v.attrib["num"]) if "num" in v.attrib else -1,
                        "txt": v.text.strip()
                    }
                    # trouve éventuellement des citations associées
                    for c in v.findall("./cit"):
                        if not "cit" in variante:
                            variante["cit"] = []
                        variante["cit"].append({
                            "aut": c.attrib["aut"].strip(),
                            "ref": c.attrib["ref"].strip(),
                            "txt": c.text.strip()
                        })
                    self.variantes.append(variante)
        return self.variantes
    
    def get_historique(self):
        """
        Assigne et retourne le noeud de type rubrique/historique.
        """
        if self.historique is None:
            self.historique = self.entree.find("./rubrique[@nom='HISTORIQUE']")
        return self.historique
    
    def get_historiques(self):
        """
        Assigne et retourne un tableau de compléments historiques.
        Chaque entrée du tableau est un dictionnaire, pouvant éventuellement
        contenir des citations.
        """
        if not self.historiques:
            historique = self.get_historique()
            if historique is not None:
                # TODO <cit>
                self.historiques = [i.text.strip() for i in historique.findall("indent")]
        return self.historiques
    
    def get_remarque(self):
        """
        Assigne et retourne le noeud de type rubrique/remarque.
        """
        if self.remarque is None:
            self.remarque = self.entree.find("./rubrique[@nom='REMARQUE']")
        return self.remarque
    
    def get_remarques(self):
        """
        Assigne et retourne un tableau de remarques.
        Chaque entrée du tableau est un dictionnaire.
        """
        if not self.remarques:
            remarque = self.get_remarque()
            if remarque is not None:
                self.remarques = [i.text for i in remarque.findall("indent")]
        return self.remarques

    def format(self):
        """
        Retourne la description de l'objet sus la forme d'un dictionnaire.
        """
        d = {}
        d["mot"] = self.mot
        d["nature"] = self.get_nature()
        d["prononciation"] = self.get_prononciation()
        d["variantes"] = self.get_variantes()
        d["remarques"] = self.get_remarques()
        d["historique"] = self.get_historiques()
        return d
