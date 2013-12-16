0#-*- coding: utf-8 -*-

__all__ = ["parsr", "reference"]

import re

import xml.etree.ElementTree as ET

from BibleParser.error import *
from BibleParser.Numbers import Number

class parser:
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

    _regexp_avoid_number_overlapping_before = None
    _regexp_avoid_number_overlapping_after  = None
    _regex_match_space_dash = None

    def __init__(self):
        # Compile diverses expressions régulières
        self._build_regular_expressions()
    
    def _build_regular_expressions(self):
        """
        Compile diverses expressions régulières utiles pour le traitement des
        versets.
        """
        # compile deux expressions régulières permettant d'éviter de capturer un
        # nombre faisant partie d'un plus grand nombre
        rb = ""
        ra = ""
        for s in Number.all_digits:
            rb += "(?<!" + s + "[ -])"
            ra += "(?![ -]" + s + ")"
        self._regexp_avoid_number_overlapping_before = rb
        self._regexp_avoid_number_overlapping_after  = ra
        # compile une expression régulière permettant de détecter et de
        # supprimer une indication de numérotation secondaire dans un verset
        self._regex_match_alter_verse = re.compile("\(\d+[.:-]\d+\) ?")
        # compile une expression régulière permettant de détecter un espace ou
        # un tiret
        self._regex_match_space_dash = re.compile("[ -]")

    def _verse_match_rules(self, verse):
        """
        Cherche à reconnaitre au moins un mot-clé dans le verset donné en
        argument.
        L'argument est une chaîne.
        TODO if faut fusionner "_verse_match_rules" et "_prefix_matches" pour améliorer les perfs.
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
        s = re.escape(s)
        # Permet de passer outre les accents
        if not self._accent_sensitivity:
            for accents in self._accent_mapping:
                p = "["+accents+"]"
                # la fonction re.escape ajoute des '\' avant les accents
                s = re.sub("\\\?"+p, p, s)
        # Délimite le mot à chercher
        if self._word_boundary:
            s = r"\b"+s+r"\b"
        # Capture du mot dans un groupe
        s = "("+s+")"
        if self._case_sensitive:
            return re.compile(s)
        else:
            return re.compile(s, re.I)
    
    def _compile_range_regex(self, low, high):
        """
        Compile une expression régulière capable de détecter tout nombre compris
        dans un intervalle, sois dans sa représentation numérique, sois dans sa
        représentation textuelle.
        """
        if high == -1:
            ran = (low,)
        else:
            ran = range(low, high+1)
        values = []
        for n in ran:
            values.append(str(n))
            litteral_number = str(Number(n))
            # ne fait pas de différence entre les tirets et les espaces
            litteral_number = self._regex_match_space_dash.sub("[ -]", litteral_number)
            values.append(litteral_number)
        # évite le recoupemement par l'arrière
        numbers = self._regexp_avoid_number_overlapping_before
        # un OU entre chaque chiffre ou nombre textuel contenu dans l'intervalle
        # et délimité par un séparateur de mot
        numbers += r"\b("+("|".join(values))+r")\b"
        # évite le recoupemement par l'avant
        numbers += self._regexp_avoid_number_overlapping_after
        return re.compile(numbers)
    
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
    
    def add_number_in_range(self, low, high=-1):
        """
        Ajoute à la liste un intervalle de nombres à détecter.
        """
        if not isinstance(low, int) or not isinstance(high, int):
            raise ValueError("expect integers")
        if high != -1:
            if high <= low:
                raise ValueError("the range is not valid")
        # Les nombres sont recherchées de la même manière que les mots dont un
        # seul est nécessaire
        self._one_of_keywords.append(self._compile_range_regex(low, high))
    
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

    def __iter__(self):
        """
        À implémenter dans une classe fille.
        """
        raise Exception("__iter__ must be implemented in sub-classes")

class reference:
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
    _regex_extract_reference = re.compile(
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
        match = reference._regex_extract_reference.match(self.input)
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

