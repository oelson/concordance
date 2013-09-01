#-*- coding: utf-8 -*-

__all__ = ["BibleReference"]

from re import compile as compile_re

#from BibleParser.XMLBibleParser import XMLBibleParser
from BibleParser.Errors import *

class BibleReference:
    """
    Une référence biblique.
    L'entrée est donnée sous la forme canonique:
    
        "Livre[ ch1[-ch2][.vr1[-vr2]]]"
    
    Où:
        ° "Livre" est le nom du livre (commençant éventuellement par un nombre
          suivi d'un espace et contenant éventuellement plusieurs espace), 
        ° "ch1" est le numéro de chapitre à partir duquel parcourir
        ° "ch2" est le numéro de chapitre à partir duquel cesser de parcourir
        ° "vr1" est le numéro de verset à partir duquel parcourir
        ° "vr2" est le numéro de verset à partir duquel cesser de parcourir
    Par exemple, "1 Roi 2-8.17-69" désigne tous les versets du 1er livre des,
    rois entre les chapitres 2 et 8 (inclus) dont le numéro est compris entre 17
    et 69.
    Il est également possible de spécifier un opérateur "quelconque":
    "1 Roi *.17-69" signifie tous les versets 17 à 69 de chaque chapitre du 1er
    livre des rois.
    """
    
    book         = None
    chapter_low  = None
    chapter_high = None
    verse_low    = None
    verse_high   = None

    # Masque d'extraction des éléments composant une référence
    _regex_extract_reference = compile_re(
        """^"""
        """(?P<book>([123] )?[\w ]+)"""
        """( (((?P<chapter_low>\d+)(-(?P<chapter_high>\d+))?)"""
        """|(?P<no_chapter_index>\*))"""
        """(\.((?P<verse_low>\d+)(-(?P<verse_high>\d+))?"""
        """|(?P<no_verse_index>\*)))?)?"""
        """$"""
    )

    def __init__(self,
                 input,
                 book=None,
                 chapter_low=None,
                 chapter_high=None,
                 verse_low=None,
                 verse_high=None):
        if input and isinstance(input, str):
            self.input = input
            self.parse_input()
        else:
            self.book = book
            self.chapter_low = chapter_low
            self.chapter_high = chapter_high
            self.verse_low = verse_low
            self.verse_high = verse_high

    def parse_input(self):
        """
        Extrait les attributs d'une référence biblique sous la forme d'un
        dictionnaire.
        """
        match = BibleReference._regex_extract_reference.match(self.input)
        if match is None:
            raise BadReferenceFormat(
                'invalid reference "{}"'.format(self.input)
            )
        attr = match.groupdict()
        # Extraction des attributs du livre
        if attr['book'] is None:
            raise BadReferenceFormat("no book given")
        # Extraction des attributs des chapitres
        if attr['chapter_low'] is None:
            if attr['no_chapter_index'] is not None:
                attr['chapter_low'] = -1
            # Permet une sélection globale par omission à condition de ne
            # pas spécifier plus précis quand on ommet moins précis
            else:
                if attr['verse_low'] is None:
                    attr['chapter_low'] = -1
                else:
                    raise BadReferenceFormat("no chapter given")
        else:
            attr['chapter_low'] = int(attr['chapter_low'])
            if attr['chapter_high'] is not None:
                attr['chapter_high'] = int(attr['chapter_high'])
                if attr['chapter_low'] >= attr['chapter_high']:
                    raise BadReferenceFormat(
                        "invalid chapter range"
                    )
            else:
                attr['chapter_high'] = -1
        # Extraction des attributs des versets
        if attr['verse_low'] is None:
                attr['verse_low'] = -1
        else:
            attr['verse_low'] = int(attr['verse_low'])
            if attr['verse_high'] is not None:
                attr['verse_high'] = int(attr['verse_high'])
                if attr['verse_low'] >= attr['verse_high']:
                    raise BadReferenceFormat("invalid verse range")
            else:
                attr['verse_high'] = -1
        # Remplissage de l'objet
        self.book = attr['book']
        self.chapter_low = attr['chapter_low']
        self.chapter_high = attr['chapter_high']
        self.verse_low = attr['verse_low']
        self.verse_high = attr['verse_high']

    def __repr__(self):
        return self.__str__()
    
    def __str__(self):
        """
        Reconstruit la référence à partir de ses composantes.
        """
        s = self.book
        if self.chapter_low == -1:
            # Le livre a été donné seul
            return s
        if self.chapter_high == -1:
            # Le livre a été donné avec un chapitre
            s += " " + str(self.chapter_low)
        else:
            # Le livre a été donné avec un intervalle de chapitres
            s += " " + str(self.chapter_low) + "-" + str(self.chapter_high)
        if self.verse_low == -1:
            # Aucun indicateur de verset n'a été donné
            return s
        s += "." + str(self.verse_low)
        if self.verse_high != -1:
            # un intervalle de versets a été donné
            s += "-" + str(self.verse_high)
        return s

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

    def _get_chapter_size(self, chapter_element=None):
        """
        Retourne la taille du chapitre passé en argument (noeud DOM).
        """
        if chapter_element is None:
            # utilise le chapitre courant en cas d'omission
            chapter_element = self._get_xml_chapter_element()
        return self.xml_bible_parser.get_greatest_element_index(
            chapter_element,
            "v"
        )

    def _get_previous_chapter_size(self):
        """
        Obtient la taille du chapitre précédent à partir du chapitre _courant_.
        Ignore le cas où la référence comporte un intervalle de versets
        (choisi la borne basse de l'intervalle).
        """
        prev_chapt_element = self.xml_bible_parser.get_chapter_element(
            self._get_xml_book_element(),
            self.chapter_low-1
        )
        return self._get_chapter_size(prev_chapt_element)

    def get_overflowing_references(self,
                                   left_lookahead,
                                   right_lookahead):
        """
        Obtient de manière récursive des références en débordant à droite et à
        gauche aussi loin que nécessaire.
        Est un itérateur.
        """
        # sélectionne à gauche
        new_verse_low = self.verse_low - left_lookahead
        if new_verse_low < 1:
            # il est nécessaire de rechercher dans le chapitre précédent
            try:
                prev_chapt_size = self._get_previous_chapter_size()
            except InvalidChapterIndex:
                # l'itérateur s'arrête en cas de chapitre inexistant
                # ici, le premier chapitre du livre a été atteint
                pass
            else:
                # itère récursivement "à gauche" en intanciant une nouvelle
                # référence
                new_bible_reference = BibleXMLReference(
                    self.xml_bible_parser,
                    None,
                    self.book,
                    self.chapter_low-1,
                    -1,
                    # l'ancre devient le dernier verset du chapitre
                    # précédent
                    prev_chapt_size,
                    -1
                )
                for x in new_bible_reference.get_overflowing_references(
                        -new_verse_low,
                        0
                        ):
                    yield x
            # le verset le plus à gauche qui nous intéresse est borné au premier
            # verset du chapitre _courant_
            new_verse_low = 1
        # sélectionne à droite
        new_verse_high = self.verse_low + right_lookahead
        # obtient la taille du chapitre
        chapter_size = self._get_chapter_size()
        if new_verse_high > chapter_size:
            # il est nécessaire de rechercher dans le chapitre suivant
            # itère récursivement "à droite"
            new_bible_reference = BibleXMLReference(
                self.xml_bible_parser,
                None,
                self.book,
                self.chapter_low+1,
                -1,
                # l'ancre devient le premier verset du chapitre suivant
                1,
                -1
            )
            for x in new_bible_reference.get_overflowing_references(
                    0,
                    new_verse_high - chapter_size - 1
                    ):
                yield x
            # le verset le plus à droite qui nous intéresse est borné au dernier
            # verset du chapitre _courant_
            new_verse_high = chapter_size
        # à une itération donnée, retourne toujours une référence pointant sur
        # le même livre et le même chapitre
        new_bible_reference = BibleXMLReference(
            self.xml_bible_parser,
            None,
            self.book,
            self.chapter_low,
            -1,
            new_verse_low,
            new_verse_high
        )
        yield new_bible_reference
   
    