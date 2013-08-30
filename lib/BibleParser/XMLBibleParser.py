"""
TODO Créer une classe Reference() en Python similaire à celle en Javascript
"""

import re

from xml.etree.ElementTree import ElementTree, Element

class XMLBibleParser:
    """
    Un itérateur sur des versets de la bible.
    Permet de rechercher par références et par mots-clés simultanément.
    """

    # Masque d'extraction des éléments composant une référence
    _regex_extract_reference = re.compile(
        """^"""
        """(?P<book>([123] )?\w+)"""
        """( (((?P<chapter_low>\d+)(-(?P<chapter_high>\d+))?)"""
        """|(?P<no_chapter_index>\*))"""
        """(\.((?P<verse_low>\d+)(-(?P<verse_high>\d+))?"""
        """|(?P<no_verse_index>\*)))?)?"""
        """$"""
    )
    
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
    
    _accent_sensitivity = True
    _case_sensitive     = False
    _word_boundary      = True
    _highlight_prefix   = None
    
    class ReferenceError(ValueError):
        pass
    
    def __init__(self, xml):
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
        """
        attr = self.parse_reference(reference)
        self.references[reference] = attr

    def add_contextual_reference(self, reference, left_lookahead, right_lookahead):
        """
        Ajoute une référence simple en l'élargissant afin d'en faire ressortir
        le contexte.
        """
        attr = self.parse_reference(reference)
        for (new_book, new_chapter, new_verse_low, new_verse_high) in \
                self._get_overflowing_references(
                    attr["book"],
                    attr["chapter_low"],
                    attr["verse_low"],
                    left_lookahead,
                    right_lookahead
                ):
            # construit une nouvelle référence
            new_attr = {
                "book": new_book,
                "chapter_low": new_chapter,
                "chapter_high": -1,
                "verse_low":  new_verse_low,
                "verse_high": new_verse_high,
            }
            new_reference = "{} {}.{}-{}".format(
                new_attr["book"],
                new_attr["chapter_low"],
                new_attr["verse_low"],
                new_attr["verse_high"]
            )
            # ajoute la nouvelle référence
            self.references[new_reference] = new_attr
    
    def _get_overflowing_references(self,
                                    book,
                                    chapter,
                                    verse,
                                    left_lookahead,
                                    right_lookahead):
        """
        Obtient de manière récursive des références à partir d'une ancre
        (l'index "verse") en débordant à droite et à gauche aussi loin que
        nécessaire.
        Est un itérateur.
        """
        # récupère les noeuds du DOM
        book_element = self._get_book_element(book)
        try:
            chapter_element = self._get_chapter_element(book_element, chapter)
        except XMLBibleParser.ReferenceError:
            # Le livre a été entièrement parcouru à droite
            return None
        verse_element = self._get_verse_element(chapter_element, verse)
        # initialise l'intervalle
        verse_low  = -1
        verse_high = -1
        verse_count = self._get_greatest_element_index(chapter_element, "v")
        ## Sélection à gauche
        left_diff = verse - left_lookahead
        if left_diff < 1:
            try:
                prev_chapt_element = self._get_chapter_element(book_element, chapter-1)
            except XMLBibleParser.ReferenceError:
                # Le livre a été entièrement parcouru à gauche
                pass
            else:
                prev_chapt_size = self._get_greatest_element_index(prev_chapt_element, "v")
                # il est nécessaire de sélectionner le chapitre précédent
                for x in self._get_overflowing_references(
                            book,
                            chapter-1,
                            # l'ancre devient le dernier verset du chapitre
                            # précédent
                            prev_chapt_size,
                            -left_diff,
                            0
                        ):
                    yield x
            verse_low = 1
        else:
            verse_low = left_diff
        ## Sélection à droite
        right_diff = verse + right_lookahead
        if right_diff > verse_count:
            # il est nécessaire de sélectionner le chapitre suivant
            verse_high = verse_count
            for x in self._get_overflowing_references(
                        book,
                        chapter+1,
                        # l'ancre devient le premier verset du chapitre suivant
                        1,
                        0,
                        right_diff - verse_count - 1
                    ):
                yield x
        else:
            verse_high = right_diff
        # Retour
        yield (book, chapter, verse_low, verse_high)

    def parse_reference(self, reference):
        """
        Extrait les attributs d'une référence biblique sous la forme d'un
        dictionnaire.
        """
        match = XMLBibleParser._regex_extract_reference.match(reference)
        if match is None:
            raise XMLBibleParser.ReferenceError(
                'invalid reference "{}"'.format(reference)
            )
        attr = match.groupdict()
        # Extraction des attributs du livre
        if attr['book'] is None:
            raise XMLBibleParser.ReferenceError("no book given")
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
                    raise XMLBibleParser.ReferenceError("no chapter given")
        else:
            attr['chapter_low'] = int(attr['chapter_low'])
            if attr['chapter_high'] is not None:
                attr['chapter_high'] = int(attr['chapter_high'])
                if attr['chapter_low'] >= attr['chapter_high']:
                    raise XMLBibleParser.ReferenceError(
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
                    raise XMLBibleParser.ReferenceError("invalid verse range")
            else:
                attr['verse_high'] = -1
        return attr

    def _get_greatest_element_index(self, root, element):
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
        """
        self._highlight_prefix = None

    def _parse_verse(self, book, chapter, verse):
        """
        TODO
        """
        if verse.text is None:
            return
        # barrière de concordance avec les mots-clés
        if not self._verse_match_rules(verse.text):
            return
        text = verse.text if self._highlight_prefix is None else \
               self._prefix_matches(verse.text)
        return (
            book.attrib["n"],
            int(chapter.attrib["n"]),
            int(verse.attrib["n"]),
            text
        )

    def _get_book_element(self, book_name):
        """
        TODO
        """
        book = self.bible.find('./b[@n="{}"]'.format(book_name))
        if book is None:
            raise XMLBibleParser.ReferenceError(
                'invalid book name "{}"'.format(book_name)
            )
        return book

    def _get_chapter_element(self, book, chapter_index):
        """
        TODO
        """
        chapter = book.find('./c[@n="{}"]'.format(chapter_index))
        if chapter is None:
            raise XMLBibleParser.ReferenceError(
                'invalid chapter number "{}"'.format(chapter_index)
            )
        return chapter
    
    def _get_verse_element(self, chapter, verse_index):
        """
        TODO
        """
        verse = chapter.find('./v[@n="{}"]'.format(verse_index))
        if verse is None:
            raise XMLBibleParser.ReferenceError(
                'invalid verse index "{}"'.format(verse_index)
            )
        return verse
    
    def _build_chapter_range(self, book, attr):
        """
        TODO
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
        TODO
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
