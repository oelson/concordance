#-*- coding: utf-8 -*-

__all__ = ["XMLBibleParser"]

import re

import xml.etree.ElementTree as ET

from BibleParser.BibleReference import BibleXMLReference
from BibleParser.Errors import *
from BibleParser.Numbers import Number

class XMLBibleParser(BibleParser):
    """
    Une implémentation de "BibleParser" manipulant un fichier XML organisé de
    la manière suivante:
    /bible          : la racine
        /b          : une suite de livres
            /c      : une liste de chapitres
                /v  : une liste de versets
    Chacun des noeuds "b", "c" ou "v" est identifié par un attribut "n".
    """

    def __init__(self, xml_content):
        """
        Parse le contenu du fichier XML contenant la bible et sauve la racine
        sous l'attribut "bible".
        """
        # TODO appeler le constructeur parent ?
        BibleParser.__init__(self)
        if not isinstance(xml_content, str):
            raise ValueError("expected the content of an XML file")
        self.bible = ET.fromstring(xml_content)
        # Crée une carte des liens parentaux entre tous les éléments du XML
        self._parent_map = dict((c, p) for p in self.bible.iter() for c in p)

    def get_element_parent(self, element):
        """
        Un ajout à l'interface ElementTree : permet de sélectionner le parent de
        tout nœud.
        """
        return self._parent_map[element]

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
        text = verse_element.text
        # enlève les indications potentielles de numérotation altérée de verset
        text = self._regex_match_alter_verse.sub("", text)
        # barrière de concordance avec les mots-clés
        if not self._verse_match_rules(text):
            return
        # mise en surbrillance
        if self._highlight_prefix is not None:
            text = self._prefix_matches(text)
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
                self.get_element_parent(chapter_element).attrib["n"],
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
