#-*- coding: utf-8 -*-

__all__ = ["BibleXMLReference"]

from re import compile as compile_re

#from BibleParser.XMLBibleParser import XMLBibleParser
from BibleParser.Errors import *

class BibleXMLReference(BibleReference):
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
        BibleReference.__init__(
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
        yield BibleXMLReference(
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
   
    
