#-*- coding: utf-8 -*-

__all__ = ["BibleParser"]

import re

import xml.etree.ElementTree as ET

from BibleParser.BibleReference import BibleXMLReference
from BibleParser.Errors import *
from BibleParser.Numbers import Number

class BibleParser:
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
        # TODO ne pas déborder au delà d'un chapitre dans le contexte pour les Psaumes
        # TODO il faut permettre un choix entre plusieurs types de débordement (coupe exacte, au dernier point, au chapitre, au livre)
        bible_reference = BibleXMLReference(self, reference)
        for new_bible_reference in bible_reference.get_overflowing_references(
                left_lookahead,
                right_lookahead
                ):
            # ajoute la nouvelle référence
            self.references[str(new_bible_reference)] = new_bible_reference

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
