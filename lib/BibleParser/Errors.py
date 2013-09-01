#-*- coding: utf-8 -*-
"""
Toutes les erreurs du projet.
"""

__all__ = [
    "BibleParserError",
    "BadReferenceFormat",
    "InvalidBookName",
    "InvalidChapterIndex",
    "InvalidVerseIndex"
]


class BibleParserError(ValueError):
    """
    Classe mère des erreurs.
    """
    def __repr__(self):
        return self.__str__()

class BadReferenceFormat(BibleParserError):
    """
    Erreur de format de référence.
    Doit-être levée lorsqu'une tentative de découpage de référence échoue.
    """
    pass

class InvalidBookName(BibleParserError):
    def __init__(self, book_name):
        self.book_name = book_name

    def __str__(self):
        return 'invalid book name "{}"'.format(self.book_name)

class InvalidChapterIndex(InvalidBookName):
    def __init__(self, book_name, chapter_index):
        self.book_name = book_name
        self.chapter_index = chapter_index

    def __str__(self):
        return 'invalid chapter index "{}" in book "{}"'.format(
            self.chapter_index,
            self.book_name
        )

class InvalidVerseIndex(InvalidChapterIndex):
    def __init__(self, book_name, chapter_index, verse_index):
        self.book_name = book_name
        self.chapter_index = chapter_index
        self.verse_index = verse_index

    def __str__(self):
        return 'invalid verse index "{}" in chapter "{}" from book "{}"'.format(
            self.verse_index,
            self.book_name,
            self.chapter_index
        )
