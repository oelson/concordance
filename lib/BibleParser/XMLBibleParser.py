#-*- coding: utf-8 -*-

__all__ = ["XMLBibleParser"]

"""
TODO ne pas déborder au delà d'un chapitre dans le contexte pour les Psaumes
"""

import re

from xml.etree.ElementTree import ElementTree, Element

from BibleParser.BibleReference import BibleXMLReference
from BibleParser.Errors import *

class XMLBibleParser:
    """
    Un itérateur sur des versets de la bible.
    Permet de rechercher par références et par mots-clés simultanément.
    """

    _accent_mapping = [
        "ÀÁÂÄÆA",
        "àáâäæa",
        "ÈÉÊËE",
        "èéêëe",
        "ÌÍÎÏI",
        "ìíîïi",
        "ÑN",
        "ñn",
        "ÒÓÔÖO",
        "òóôöo",
        "ÙÚÛÜU",
        "ùúûüu"
    ]

    _mandatory_keywords = []
    _one_of_keywords    = []
    _none_of_keywords   = []
    _number_ranges      = []
    
    references = {}
    
    _accent_sensitivity = False
    _case_sensitive     = False
    _word_boundary      = True
    _highlight_prefix   = None

    def __init__(self, xml):
        """
        Le 1er argument doit-être:
            ° soit une instance de "Element" (un noeud racine de la bible)
            ° soit un chemin vers un fichier XML de la bible
        """
        if isinstance(xml, Element):
            self.bible = xml
        elif isinstance(xml, str):
            tree = ElementTree()
            self.bible = tree.parse(xml)
        else:
            raise ValueError("'xml' argument is not an 'ElementTree' instance nor a path to a XML file")

    def add_reference(self, reference):
        """
        Ajoute une référence en l'état.
        L'entrée est une chaîne, ce qui est stocké est une instance de la classe
        "BibleXMLReference".
        """
        bible_reference = BibleXMLReference(self, reference)
        self.references[str(bible_reference)] = bible_reference

    def add_contextual_reference(self,
                                 reference,
                                 left_lookahead,
                                 right_lookahead):
        """
        Ajoute une référence simple en l'élargissant afin d'en faire ressortir
        le contexte.
        """
        bible_reference = BibleXMLReference(self, reference)
        for new_bible_reference in bible_reference.get_overflowing_references(
                left_lookahead,
                right_lookahead
                ):
            # ajoute la nouvelle référence
            self.references[str(new_bible_reference)] = new_bible_reference

    def get_greatest_element_index(self, root, element):
        """
        Retourne le plus grand index (attribut "n") des sous-éléments du
        noeud racine /root/.
        Les éléments sont de type /element/.
        """
        greatest = None
        for child in root.iterfind("./{}".format(element)):
            greatest = child
        if greatest is None:
            return greatest
        return int(greatest.attrib["n"])

    def _verse_match_rules(self, verse):
        """
        Cherche à reconnaitre au moins un mot-clé dans le verset donné en
        argument.
        L'argument est une chaîne.
        """
        # mots étants _tous_ obligatoires
        for r in self._mandatory_keywords:
            if not r.search(verse):
                return False
        # mots dont au moins un est nécessaire
        if len(self._one_of_keywords) > 0:
            one_found = False
            for r in self._one_of_keywords:
                if r.search(verse):
                    one_found = True
                    break
            if not one_found:
                return False
        # mots interdits
        for r in self._none_of_keywords:
            if r.search(verse):
                return False
        # TODO Recherche de nombres via un intervalle numérique
        return True
    
    def _prefix_matches(self, text):
        """
        Ajoute aux mots-clés trouvés dans le texte un préfixe et un suffixe.
        """
        p = self._highlight_prefix + r"\1" + self._highlight_prefix
        # mots étants _tous_ obligatoires
        for r in self._mandatory_keywords:
            text = r.sub(p, text)
        # mots dont au moins un est nécessaire
        if len(self._one_of_keywords) > 0:
            for r in self._one_of_keywords:
                text = r.sub(p, text)
        return text
    
    def _compile_keyword_regex(self, s):
        """
        Compile une expression régulière détectant un mot délimité, avec ou sans
        sensibilité à la case.
        """
        # Permet de passer outre les accents
        if not self._accent_sensitivity:
            for accents in self._accent_mapping:
                p = "["+accents+"]"
                s = re.sub(p, p, s)
        # Délimite le mot à chercher
        if self._word_boundary:
            s = r"\b"+s+r"\b"
        # Capture du mot dans un groupe
        s = "("+s+")"
        if self._case_sensitive:
            return re.compile(s)
        else:
            return re.compile(s, re.I)
    
    def add_mandatory_keywords(self, words):
        """
        Ajoute à la liste des mots-clés tous obligatoires.
        """
        self._mandatory_keywords.extend([
            self._compile_keyword_regex(x) for x in words
        ])

    def add_one_of_keywords(self, words):
        """
        Ajoute à la liste des mots-clés dont _un seul_ est obligatoire.
        """
        self._one_of_keywords.extend([
            self._compile_keyword_regex(x) for x in words
        ])

    def add_none_of_keywords(self, words):
        """
        Ajoute à la liste noire des mots-clés.
        """
        self._none_of_keywords.extend([
            self._compile_keyword_regex(x) for x in words
        ])
    
    def add_number_in_range(self, ran):
        """
        Ajoute à la liste un intervalle de nombres à détecter.
        """
        l, h = int(ran["low"]), int(ran["high"])
        if h > l:
            raise ValueError("the range is not valid")
        self._number_ranges.append((l,h))
    
    def set_case_sensitivity(self, sensitive):
        """
        Active ou non l'insensibilité à la case.
        """
        self._case_sensitive = sensitive
    
    def set_accent_sensitivity(self, sensitive):
        """
        Active ou non l'insensibilité aux accents.
        """
        self._accent_sensitivity = sensitive
    
    def set_word_boundary(self, bound):
        """
        Active ou non la reconnaissance de mots entiers.
        """
        self._word_boundary = bound
    
    def clean(self):
        """
        Rétablit le parseur dans son état initial.
        """
        self.references.clear()
        self._mandatory_keywords.clear()
        self._one_of_keywords.clear()
        self._none_of_keywords.clear()
        self._number_ranges.clear()
    
    def enable_highlighting(self, s):
        """
        Préfixe et suffixe les correspondances dans les versets retournés par
        une chaîne.
        """
        self._highlight_prefix = s

    def disable_highlighting(self):
        """
        Désactive le préfixage des correspondances.
        """
        self._highlight_prefix = None

    def _parse_verse(self, book_element, chapter_element, verse_element):
        """
        Vérifie qu'un verset (donné par son noeud) satisfait les exigences de
        la recherche par mots-clés.
        Si oui, alors les correpondances sont éventuellement mises en
        surbrillance.
        Retourne un quadruplet contenant le nom du livre, les indices du
        chapitre et du verset, et son texte.
        """
        if verse_element.text is None:
            return
        # barrière de concordance avec les mots-clés
        if not self._verse_match_rules(verse_element.text):
            return
        text = verse_element.text if self._highlight_prefix is None else \
               self._prefix_matches(verse_element.text)
        return (
            book_element.attrib["n"],
            int(chapter_element.attrib["n"]),
            int(verse_element.attrib["n"]),
            text
        )

    def _get_book_element(self, book_name):
        """
        Retourne le noeud du livre dont le nom est passé en argument.
        """
        book = self.bible.find('./b[@n="{}"]'.format(book_name))
        if book is None:
            raise XMLBibleParser.ReferenceError(
                'invalid book name "{}"'.format(book_name)
            )
        return book

    def _get_chapter_element(self, book, chapter_index):
        """
        Retourne le noeud du chapitre dont le numéro est passé en argument.
        Le livre doit-être donné en premier argument en tant que noeud DOM.
        """
        chapter = book.find('./c[@n="{}"]'.format(chapter_index))
        if chapter is None:
            raise XMLBibleParser.ReferenceError(
                'invalid chapter number "{}"'.format(chapter_index)
            )
        return chapter
    
    def _get_verse_element(self, chapter, verse_index):
        """
        Retourne le noeud du verset dont le numéro est passé en argument.
        Le chapitre doit-être donné en premier argument en tant que noeud DOM.
        """
        verse = chapter.find('./v[@n="{}"]'.format(verse_index))
        if verse is None:
            raise XMLBibleParser.ReferenceError(
                'invalid verse index "{}"'.format(verse_index)
            )
        return verse
    
    def _build_chapter_range(self, book, attr):
        """
        Construit un intervalle dense d'indices de chapitres à partir d'une
        référence.
        Le livre doit-être donné en premier argument en tant que noeud DOM.
        """
        # Sélectionne tous les chapitres
        if attr["chapter_low"] == -1:
            chapter_range = range(
                1,
                self._get_greatest_element_index(book, "c")+1
            )
        # Sélectionne un intervalle de chapitres
        elif attr["chapter_high"] != -1:
            chapter_range = range(
                attr["chapter_low"],
                attr["chapter_high"]+1
            )
        # Sélectionne un seul chapitre
        else:
            chapter_range = (attr["chapter_low"],)
        return chapter_range
    
    def _build_verse_range(self, chapter, attr):
        """
        Construit un intervalle dense d'indices de versets à partir d'une
        référence.
        Le chapitre doit-être donné en premier argument en tant que noeud DOM.
        """
        # Sélectionne tous les versets du chapitre
        if attr["verse_low"] == -1:
            verse_range = range(
                1,
                self._get_greatest_element_index(chapter, "v")+1
            )
        # Sélectionne un intervalle de versets
        elif attr["verse_high"] != -1:
            verse_range = range(
                attr["verse_low"],
                attr["verse_high"]+1
            )
        # Sélectionne un seul verset
        else:
            verse_range = (attr["verse_low"],)
        return verse_range

    def __iter__(self):
        """
        Recherche dans la bible à partir de références et les retournes une 
        à une sous la forme de chaînes préfixées par leur référence.
        """
        # Parcours toute la bible en cas d'absence de référence
        if not self.references:
            for book in self.bible.iterfind("./b"):
                for chapter in book.iterfind("./c"):
                    for verse in chapter.iterfind("./v"):
                        res = self._parse_verse(book, chapter, verse)
                        if res is not None:
                            yield res
        # Parcours uniquement des références précises
        else:
            for ref in self.references:
                attr = self.references[ref]
                book = self._get_book_element(attr["book"])
                chapter_range = self._build_chapter_range(book, attr)
                for chapter_index in chapter_range:
                    chapter = self._get_chapter_element(book, chapter_index)
                    verse_range = self._build_verse_range(chapter, attr)
                    for verse_index in verse_range:
                        verse = self._get_verse_element(chapter, verse_index)
                        res = self._parse_verse(book, chapter, verse)
                        if res is not None:
                            yield res
