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
    _exact_expressions  = []
    
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

    def get_book_size(self, book_element):
        """
        Retourne la taille du livre passé en argument (noeud DOM).
        """
        return self.get_greatest_element_index(
            book_element,
            "c"
        )
    
    def get_chapter_size(self, chapter_element):
        """
        Retourne la taille du chapitre passé en argument (noeud DOM).
        """
        return self.get_greatest_element_index(
            chapter_element,
            "v"
        )
    
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
    
    def add_exact_expression(self, expr):
        """
        Ajoute une expression exacte à rechercher.
        """
        # Les expressions exactes sont recherchées de la même manière que les
        # mots dont un seul est nécessaire
        self._one_of_keywords.append(self._compile_keyword_regex(expr))
    
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
        Retourne une paire consistant en un objet de type "BibleXMLReference"
        et son texte.
        """
        if verse_element.text is None:
            return
        # barrière de concordance avec les mots-clés
        if not self._verse_match_rules(verse_element.text):
            return
        text = verse_element.text if self._highlight_prefix is None else \
               self._prefix_matches(verse_element.text)
        return (
            BibleXMLReference(
                self,
                None,
                book_element.attrib["n"],
                int(chapter_element.attrib["n"]),
                None,
                int(verse_element.attrib["n"]),
                None
            ),
            text
        )

    def get_book_element(self, book_name):
        """
        Retourne le noeud du livre dont le nom est passé en argument.
        """
        book_element = self.bible.find('./b[@n="{}"]'.format(book_name))
        if book_element is None:
            raise InvalidBookName(book_name)
        return book_element

    def get_chapter_element(self, book_element, chapter_index):
        """
        Retourne le noeud du chapitre dont le numéro est passé en argument.
        Le livre doit-être donné en premier argument en tant que noeud DOM.
        """
        chapter_element = book_element.find('./c[@n="{}"]'.format(chapter_index))
        if chapter_element is None:
            raise InvalidChapterIndex(
                book_element.attrib["n"],
                chapter_index
            )
        return chapter_element
    
    def get_verse_element(self, chapter_element, verse_index):
        """
        Retourne le noeud du verset dont le numéro est passé en argument.
        Le chapitre doit-être donné en premier argument en tant que noeud DOM.
        """
        verse_element = chapter_element.find('./v[@n="{}"]'.format(verse_index))
        if verse_element is None:
            raise InvalidVerseIndex(
                "UNK_BOOK", # TODO element.getparent() ?
                # book.attrib["n"],
                chapter_element.attrib["n"],
                verse_index
            )
        return verse_element
    
    def _build_chapter_range(self, book_element, bible_reference):
        """
        Construit un intervalle dense d'indices de chapitres à partir d'une
        référence.
        Le livre doit-être donné en premier argument en tant que noeud DOM.
        """
        # Sélectionne tous les chapitres
        if bible_reference.chapter_low == -1:
            chapter_range = range(
                1,
                self.get_greatest_element_index(book_element, "c")+1
            )
        # Sélectionne un intervalle de chapitres
        elif bible_reference.chapter_high != -1:
            chapter_range = range(
                bible_reference.chapter_low,
                bible_reference.chapter_high+1
            )
        # Sélectionne un seul chapitre
        else:
            chapter_range = (bible_reference.chapter_low,)
        return chapter_range
    
    def _build_verse_range(self, chapter_element, bible_reference):
        """
        Construit un intervalle dense d'indices de versets à partir d'une
        référence.
        Le chapitre doit-être donné en premier argument en tant que noeud DOM.
        """
        # Sélectionne tous les versets du chapitre
        if bible_reference.verse_low == -1:
            verse_range = range(
                1,
                self.get_greatest_element_index(chapter_element, "v")+1
            )
        # Sélectionne un intervalle de versets
        elif bible_reference.verse_high != -1:
            verse_range = range(
                bible_reference.verse_low,
                bible_reference.verse_high+1
            )
        # Sélectionne un seul verset
        else:
            verse_range = (bible_reference.verse_low,)
        return verse_range

    def __iter__(self):
        """
        Recherche dans la bible à partir de références et les retournes une 
        à une sous la forme d'objets de type "BibleXMLReference".
        """
        # Parcours toute la bible en cas d'absence de référence
        if not self.references:
            for book_element in self.bible.iterfind("./b"):
                for chapter_element in book_element.iterfind("./c"):
                    for verse_element in chapter_element.iterfind("./v"):
                        res = self._parse_verse(
                            book_element,
                            chapter_element,
                            verse_element
                        )
                        if res is not None:
                            yield res
        # Parcours uniquement des références précises
        else:
            for reference in self.references:
                bible_reference = self.references[reference]
                # récupère le noeud du livre
                book_element = self.get_book_element(bible_reference.book)
                # construit l'intervalle des chapitres à parcourir
                chapter_range = self._build_chapter_range(
                    book_element,
                    bible_reference
                )
                for chapter_index in chapter_range:
                    # récupère le noeud du chapitre
                    chapter_element = self.get_chapter_element(
                        book_element,
                        chapter_index
                    )
                    # construit l'intervalle des versets à parcourir
                    verse_range = self._build_verse_range(
                        chapter_element,
                        bible_reference
                    )
                    for verse_index in verse_range:
                        # accède au noeud du verset
                        verse_element = self.get_verse_element(
                            chapter_element,
                            verse_index
                        )
                        res = self._parse_verse(
                            book_element,
                            chapter_element,
                            verse_element
                        )
                        if res is not None:
                            yield res
