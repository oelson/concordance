#-*- coding: utf-8 -*-

from math import log10

class Number:
    """
    Convertit un entier naturel en son équivalent textuel (sous la base 10).
    """

    _units = [
        "un",
        "dix",
        "cent",
        "mille",
        "million",
        "milliard"
    ]
    
    _dizains = [
        "zéro",
        "un",
        "deux",
        "trois",
        "quatre",
        "cinq",
        "six",
        "sept",
        "huit",
        "neuf",
        "dix",
        "onze",
        "douze",
        "treize",
        "quatorze",
        "quinze",
        "seize",
        "dix-sept",
        "dix-huit",
        "dix-neuf"
    ]
    
    _dizains_units = [
        "un",
        "dix",
        "vingt",
        "trente",
        "quarante",
        "cinqante",
        "soixante",
        "soixante-dix",
        "quatre-vingt",
        "quatre-vingt-dix"
    ]
    
    # l'ensemble du texte des chiffres 
    all_digits = _units[1:] + _dizains[:-3] + _dizains_units[2:7]
    
    number = None
    representation = None
    
    def __init__(self, input):
        if isinstance(input, int):
            self.number = input
        elif isinstance(input, str):
            self.number = int(input)
    
    def _get_n_digits(self):
        """
        Retourne le nombre de chiffres dans un nombre écrit en base 10.
        """
        if self.number > 0:
            return int(log10(self.number))+1
        elif self.number == 0:
            return 1
        else:
            return int(log10(-self.number))+2
    
    def _parse_centains(self, n):
        """
        Transforme un nombre compris entre 0 et 999 en son équivalent textuel.
        """
        if not 0 <= n <= 999:
            raise ValueError("this method should only take a number between 0 and 999")
        s = ""
        ## Centaines
        c = n // 100
        if c > 0:
            if c > 1:
                # commence par le chiffre écrit textuellement
                s += self._dizains[c] + " "
            # accole le suffixe "cent"
            s += self._units[2]
        ## Dizaines
        d = n % 100
        if 1 <= d < 20:
            if s: s += " "
            s += self._dizains[d]
            return s
        if d > 0:
            dizain, units = divmod(d, 10)
            # 70 et 90
            if dizain in (7, 9) and units > 0:
                if s: s += " "
                s += self._dizains_units[dizain-1]
                units += 10
            else:
                if s: s += " "
                s += self._dizains_units[dizain]
            if units > 0:
                if dizain not in (8, 9) and units % 10 == 1:
                    s += "-et"
                s += "-" + self._dizains[units]
        return s
    
    def parse(self):
        # Cas particulier pour zéro
        if self.number == 0:
            return self._dizains[0]
        s = ""
        # itère sur des puissances croissantes de 1000
        # ex: 333 123 456 sera parcouru comme (456, 123, 333)
        digits = self._get_n_digits()
        # avance en puissances de 1000 en puissances de 1000
        for p in range(0, digits, 3):
            mask = 10 ** p
            # extrait les "centaines" de chaque puissance de 1000
            centains = (self.number // mask) % 1000
            # n'affiche pas les puissances de milles valant zéro
            if centains > 0:
                if p == 3 and centains == 1:
                    # cas particulier: on ne dit pas "un mille"
                    partial_repr = ""
                else:
                    partial_repr = self._parse_centains(centains)
                # unité (à partir des milliers) associée à la puissance de 1000
                unit = p//3+2
                if unit > 2:
                    if partial_repr: partial_repr += " "
                    partial_repr += self._units[unit]
                # ajoute le nouveau morceau au début, en évitant d'insérer un
                # espace inutile à la fin
                new_s = partial_repr
                if s:
                    new_s += " " + s
                s = new_s
        return s

    def __repr__(self):
        return self.__str__()
    
    def __str__(self):
        if self.representation is None:
            self.representation = self.parse()
        return self.representation
