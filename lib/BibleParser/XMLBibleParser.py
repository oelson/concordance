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

    # Nombre de versets à sélectionner autours d'une référence lors d'un
    # élargissement
    _context_size = 20

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
    
    def __init__(self, xml, lexicon=None):
        if isinstance(xml, Element):
            self.bible = xml
        elif isinstance(xml, str):
            tree = ElementTree()
            self.bible = tree.parse(xml)
        else:
            raise ValueError("'xml' argument is not an 'ElementTree' instance nor a path to a XML file")
        if lexicon is not None and not isinstance(lexicon, LexicalContext):
            raise ValueError("'lexicon' parameter is not a 'LexicalContext' instance")
        self.lexicon = lexicon

    def add_reference(self, ref):
        """
        Ajoute une référence en l'état.
        """
        attr = self.parse_reference(ref)
        self.references[ref] = attr

    def add_contextual_reference(self, ref):
        """
        Ajoute une référence simple en l'élargissant afin d'en faire ressortir
        le contexte.
        """
        attr = self.parse_reference(ref)
        attr["verse_low"]  -= self._context_size
        attr["verse_high"] += self._context_size
        # L'indice maximum d'un verset pour le chapitre sélectionné
        book = self._get_book_element(attr["book"])
        chapter = self._get_chapter_element(book, attr["chapter_low"])
        max_index = self._get_greatest_element_index(chapter, "v")+1
        # Vérifie les bornes de la référence
        if attr["verse_low"] < 1:
            attr["verse_low"] = 1
        if attr["verse_high"] > max_index:
            attr["verse_high"] = max_index
        self.references[ref] = attr

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
        attribs = match.groupdict()
        # Extraction des attributs du livre
        if attribs['book'] is None:
            raise XMLBibleParser.ReferenceError("no book given")
        # Extraction des attributs des chapitres
        if attribs['chapter_low'] is None:
            if attribs['no_chapter_index'] is not None:
                attribs['chapter_low'] = -1
            # Permet une sélection globale par omission à condition de ne
            # pas spécifier plus précis quand on ommet moins précis
            else:
                if attribs['verse_low'] is None:
                    attribs['chapter_low'] = -1
                else:
                    raise XMLBibleParser.ReferenceError("no chapter given")
        else:
            attribs['chapter_low'] = int(attribs['chapter_low'])
            if attribs['chapter_high'] is not None:
                attribs['chapter_high'] = int(attribs['chapter_high'])
                if attribs['chapter_low'] >= attribs['chapter_high']:
                    raise XMLBibleParser.ReferenceError(
                        "invalid chapter range"
                    )
            else:
                attribs['chapter_high'] = -1
        # Extraction des attributs des versets
        if attribs['verse_low'] is None:
                attribs['verse_low'] = -1
        else:
            attribs['verse_low'] = int(attribs['verse_low'])
            if attribs['verse_high'] is not None:
                attribs['verse_high'] = int(attribs['verse_high'])
                if attribs['verse_low'] >= attribs['verse_high']:
                    raise XMLBibleParser.ReferenceError("invalid verse range")
            else:
                attribs['verse_high'] = -1
        return attribs

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
        # TODO range
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
        """
        if verse.text is None:
            return
        # barrière de concordance avec les mots-clés
        if not self._verse_match_rules(verse.text):
            return
        # mise-à-jour du lexique
        if self.lexicon:
            self.lexicon.update(verse.text)
        text = verse.text if self._highlight_prefix is None else \
               self._prefix_matches(verse.text)
        return (
            book.attrib["n"],
            int(chapter.attrib["n"]),
            int(verse.attrib["n"]),
            text
        )

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
            for reference in self.references:
                attribs = self.parse_reference(reference)
                book = self.bible.find('./b[@n="{}"]'.format(attribs['book']))
                if book is None:
                    raise XMLBibleParser.ReferenceError(
                        'invalid book name "{}"'.format(attribs['book'])
                    )
                # Sélectionne tous les chapitres
                if attribs['chapter_low'] == -1:
                    chapter_range = range(
                        1,
                        self._get_greatest_element_index(book, 'c')+1
                    )
                # Sélectionne un intervalle de chapitres
                elif attribs['chapter_high'] != -1:
                    chapter_range = range(
                        attribs['chapter_low'],
                        attribs['chapter_high']+1
                    )
                # Sélectionne un seul chapitre
                else:
                    chapter_range = (attribs['chapter_low'],)
                for chapter_index in chapter_range:
                    chapter = book.find('./c[@n="{}"]'.format(
                        chapter_index
                    ))
                    if chapter is None:
                        raise XMLBibleParser.ReferenceError(
                            'invalid chapter number "{}"'.format(
                                chapter_index
                            )
                        )
                    # Sélectionne tous les versets du chapitre
                    if attribs['verse_low'] == -1:
                        verse_range = range(
                            1,
                            self._get_greatest_element_index(chapter, 'v')+1
                        )
                    # Sélectionne un intervalle de versets
                    elif attribs['verse_high'] != -1:
                        verse_range = range(
                            attribs['verse_low'],
                            attribs['verse_high']+1
                        )
                    # Sélectionne un seul verset
                    else:
                        verse_range = (attribs['verse_low'],)
                    for verse_index in verse_range:
                        verse = chapter.find('./v[@n="{}"]'.format(
                            verse_index
                        ))
                        if verse is None:
                            raise XMLBibleParser.ReferenceError(
                                'invalid verse index "{}"'.format(
                                    verse_index
                                )
                            )
                        res = self._parse_verse(book, chapter, verse)
                        if res is not None:
                            yield res
