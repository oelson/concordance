#-*- coding: utf-8 -*-

__all__ = ["XML_BibleParser", "reference"]

import re

import xml.etree.ElementTree as ET

from BibleParser.abstract import parser as abstract_parser, reference as abstract_reference
from BibleParser.error import *
from BibleParser.Numbers import Number

class parser(abstract_parser):
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
        abstract_parser.__init__(self)
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
        Retourne une paire consistant en un objet de type "reference"
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
            reference(
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
    
    def _build_chapter_range(self, book_element, ref_obj):
        """
        Construit un intervalle dense d'indices de chapitres à partir d'une
        référence.
        Le livre doit-être donné en premier argument en tant que noeud DOM.
        """
        # Sélectionne tous les chapitres
        if ref_obj.chapter_low == -1:
            chapter_range = range(
                1,
                self.get_greatest_element_index(book_element, "c")+1
            )
        # Sélectionne un intervalle de chapitres
        elif ref_obj.chapter_high != -1:
            chapter_range = range(
                ref_obj.chapter_low,
                ref_obj.chapter_high+1
            )
        # Sélectionne un seul chapitre
        else:
            chapter_range = (ref_obj.chapter_low,)
        return chapter_range
    
    def _build_verse_range(self, chapter_element, ref_obj):
        """
        Construit un intervalle dense d'indices de versets à partir d'une
        référence.
        Le chapitre doit-être donné en premier argument en tant que noeud DOM.
        """
        # Sélectionne tous les versets du chapitre
        if ref_obj.verse_low == -1:
            verse_range = range(
                1,
                self.get_greatest_element_index(chapter_element, "v")+1
            )
        # Sélectionne un intervalle de versets
        elif ref_obj.verse_high != -1:
            verse_range = range(
                ref_obj.verse_low,
                ref_obj.verse_high+1
            )
        # Sélectionne un seul verset
        else:
            verse_range = (ref_obj.verse_low,)
        return verse_range

    def add_reference(self, ref_str):
        """
        Ajoute une référence en l'état.
        L'entrée est une chaîne, ce qui est stocké est une instance de la classe
        "reference".
        """
        ref_obj = reference(self, ref_str)
        self.references[str(ref_obj)] = ref_obj

    def add_contextual_reference(self,
                                 ref_str,
                                 left_lookahead,
                                 right_lookahead):
        """
        Ajoute une référence simple en l'élargissant afin d'en faire ressortir
        le contexte.
        """
        # TODO ne pas déborder au delà d'un chapitre dans le contexte pour les Psaumes
        # TODO il faut permettre un choix entre plusieurs types de débordement (coupe exacte, au dernier point, au chapitre, au livre)
        ref_obj = reference(self, ref_str)
        for new_bible_reference in ref_obj.get_overflowing_references(
                left_lookahead,
                right_lookahead
                ):
            # ajoute la nouvelle référence
            self.references[str(new_bible_reference)] = new_bible_reference

    def __iter__(self):
        """
        Recherche dans la bible à partir de références et les retournes une 
        à une sous la forme d'objets de type "reference".
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
                ref_obj = self.references[reference]
                # récupère le noeud du livre
                book_element = self.get_book_element(ref_obj.book)
                # construit l'intervalle des chapitres à parcourir
                chapter_range = self._build_chapter_range(
                    book_element,
                    ref_obj
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
                        ref_obj
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


class reference(abstract_reference):
    """
    Une référence biblique connectée à un parseur XML.
    Ceci permet d'accéder à des fonctionnalités plus poussée:
        ° récupérer les élements DOM associés à la référence (voir _get_xml_*)
        ° récupérer la taille d'un chapitre (le chapitre courant ou le
          précédent, ou encore un autre)
        ° générer des références à partir d'un débordement à droite ou à gauche
    """

    # une instance de la classe "XMLBibleParser"
    xml_bible_parser = None

    book_xml_element    = None
    chapter_xml_element = None
    verse_xml_element   = None
    
    _book_size    = None
    _chapter_size = None
    
    def __init__(self,
                 parser,
                 input,
                 book=None,
                 chapter_low=None,
                 chapter_high=None,
                 verse_low=None,
                 verse_high=None):
        # TODO parent ?
        abstract_reference.__init__(
            self,
            input,
            book,
            chapter_low,
            chapter_high,
            verse_low,
            verse_high
        )
        self.xml_bible_parser = parser

    def _get_xml_book_element(self):
        """
        Récupère, si ce n'est déjà fait, le noeud associé au livre _courant_.
        Retourne ce  noeud.
        """
        if self.book_xml_element is None:
            self.book_xml_element = self.xml_bible_parser.get_book_element(self.book)
        return self.book_xml_element

    def _get_xml_chapter_element(self):
        """
        Récupère, si ce n'est déjà fait, le noeud associé au chapitre _courant_.
        Ignore le cas où la référence comporte un intervalle de chapitres
        (choisi la borne basse de l'intervalle).
        Retourne ce  noeud.
        """
        if self.chapter_xml_element is None:
            self.chapter_xml_element = self.xml_bible_parser.get_chapter_element(
                self._get_xml_book_element(),
                self.chapter_low
            )
        return self.chapter_xml_element

    def _get_xml_verse_element(self):
        """
        Récupère, si ce n'est déjà fait, le noeud associé au verset _courant_.
        Ignore le cas où la référence comporte un intervalle de versets
        (choisi la borne basse de l'intervalle).
        Retourne ce  noeud.
        """
        if self.verse_xml_element is None:
            self.verse_xml_element = self.xml_bible_parser.get_verse_element(
                self._get_xml_book_element(),
                self._get_xml_chapter_element(),
                self.verse_low
            )
        return self.verse_xml_element

    def _get_chapter_size(self):
        """
        Retourne la taille du chapitre _courant_.
        """
        if self._chapter_size is None:
            self._chapter_size = self.xml_bible_parser.get_chapter_size(
                self._get_xml_chapter_element()
            )
        return self._chapter_size

    def _get_book_size(self):
        """
        Retourne la taille du livre _courant_ (en nombre de chapitres).
        """
        if self._book_size is None:
            self._book_size = self.xml_bible_parser.get_book_size(
                self._get_xml_book_element()
            )
        return self._book_size

    def _get_overflowing_references(self,
                                    verse_index,
                                    chapter_index,
                                    left_lookahead,
                                    right_lookahead,
                                    chapter_element=None):
        """
        Obtient de manière récursive des références en débordant à droite et à
        gauche aussi loin que nécessaire.
        Est un itérateur.
        """
        if chapter_element is None:
            # Assume que le chapitre à trouver est donné par "chapter_index"
            chapter_element = self.xml_bible_parser.get_chapter_element(
                self._get_xml_book_element(),
                chapter_index
            )
        # Sélectionne à gauche
        new_verse_low = verse_index - left_lookahead
        if new_verse_low < 1:
            # il est nécessaire de rechercher dans le chapitre précédent
            if chapter_index > 1:
                prev_chapter_element = self.xml_bible_parser.get_chapter_element(
                    self._get_xml_book_element(),
                    chapter_index - 1
                )
                prev_chapt_size = self.xml_bible_parser.get_chapter_size(prev_chapter_element)
                # itère récursivement "à gauche" en intanciant une nouvelle
                # référence
                for r in self._get_overflowing_references(
                        # l'ancre devient le dernier verset du chapitre
                        # précédent
                        prev_chapt_size,
                        chapter_index - 1,
                        # le débordement à gauche devient le produit de la
                        # précédente soustraction
                        -new_verse_low,
                        0,
                        # donne directement le noeud précédent pour éviter un
                        # parcours supplémentaire du DOM
                        prev_chapter_element
                        ):
                    yield r
            # le verset le plus à gauche qui nous intéresse est borné au premier
            # verset du chapitre _courant_
            new_verse_low = 1
        # Sélectionne à droite
        new_verse_high = verse_index + right_lookahead
        to_yield = []
        # obtient la taille du chapitre
        chapter_size = self._get_chapter_size()
        if new_verse_high > chapter_size:
            # il est nécessaire de rechercher dans le chapitre suivant
            if chapter_index < self._get_book_size():
                # itère récursivement "à droite"
                for r in self._get_overflowing_references(
                        # l'ancre devient le premier verset du chapitre suivant
                        1,
                        chapter_index + 1,
                        0,
                        new_verse_high - chapter_size - 1
                        ):
                    # les références issues d'un débordement à droite seront levées
                    # plus tard
                    to_yield.append(r)
            # le verset le plus à droite qui nous intéresse est borné au dernier
            # verset du chapitre _courant_
            new_verse_high = chapter_size
        # À une itération donnée, retourne toujours une référence pointant sur
        # le même livre et le même chapitre
        yield reference(
            self.xml_bible_parser,
            None,
            self.book,
            chapter_index,
            -1,
            new_verse_low,
            new_verse_high
        )
        # Renvoie ler références à droite _après_ la référence _courante_
        for r in to_yield:
            yield r

    def get_overflowing_references(self,
                                   left_lookahead,
                                   right_lookahead):
        """
        Obtient de manière récursive des références en débordant à droite et à
        gauche aussi loin que nécessaire.
        """
        if left_lookahead < 1 or right_lookahead < 1:
            raise ValueError("need lookahead quantities greater than 1")
        collection = []
        for r in self._get_overflowing_references(
                self.verse_low,
                self.chapter_low,
                left_lookahead,
                right_lookahead
                ):
            collection.append(r)
        return collection
   
    
