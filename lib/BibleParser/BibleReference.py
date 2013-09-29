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
        """(?P<book>([123] )?[\w ]+?)"""
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
        if self.chapter_low is None:
            # Le livre a été donné seul
            return s
        if self.chapter_high is None or self.chapter_low == self.chapter_high:
            # Le livre a été donné avec un chapitre
            s += " " + str(self.chapter_low)
        else:
            # Le livre a été donné avec un intervalle de chapitres
            s += " " + str(self.chapter_low) + "-" + str(self.chapter_high)
        if self.verse_low is None:
            # Aucun indicateur de verset n'a été donné
            return s
        s += "." + str(self.verse_low)
        if self.verse_high is not None and self.verse_low != self.verse_high:
            # un intervalle de versets a été donné
            s += "-" + str(self.verse_high)
        return s

