/**
 * Classe décrivant une référence biblique.
 * Utiliser "parse" pour extraire les propriétés de la chaîne et "serialize"
 * pour construire une référence propre.
 */

function Reference(referenceStr)
{
    this.referenceStr = referenceStr;
    
    this.book = null;
    this.chapterRange = {"low": null, "high": null};
    this.verseRange = {"low": null, "high": null};
    
    /*
     * Reconstruit la référence de manière propre.
     */
    
    this.serialize = function()
    {
        var ref = this.book;
        if (this.chapterRange["low"]) {
            ref += " " + this.chapterRange["low"];
            if (this.chapterRange["high"]) {
                ref += "-" + this.chapterRange["high"];
            }
        }
        if (this.verseRange["low"]) {
            ref += "." + this.verseRange["low"];
            if (this.verseRange["high"]) {
                ref += "-" + this.verseRange["high"];
            }
        }
        return ref;
    };

    /*
     * Vérifie un nom de livre
     */
    
    this.chekBookName = function(book)
    {
        var list = bookListOl.children;
        for (var i=0, li; i < list.length; ++i) {
            li = list[i];
            if (book == li.textContent) {
                return true;
            }
        }
        return false;
    }
    
    /*
     * Extrait un intervalle.
     */
    
    this.extractRange = function(s, dest)
    {
        var pair = s.split("-");
        var low  = null,
            high = null;
        if (pair.length < 1 || pair.length > 2) {
            return false;
        }
        if (!/^[0-9]+$/.test(pair[0])) {
            return false;
        }
        low = parseInt(pair[0]);
        if (pair.length == 2) {
            if (!/^[0-9]+$/.test(pair[1])) {
                return false;
            }
            high = parseInt(pair[1]);
        }
        if (high !== null) {
            if (high <= low) {
                return false;
            }
        }
        dest["low"]  = low;
        dest["high"] = high
        return true;
    }
    
    /*
     * Découpe la référence pour en extraire les propriétés.
     * Il est obligatoire de trouver au moins le nom de livre.
     */

    this.parse = function()
    {
        var bookName;
        var index = 0;
        // découpe l'entrée sur les espaces
        var pieces = this.referenceStr.split(/\s+/);
        /* Nom du livre
         */
        if (!isNaN(pieces[index])) {
            // le nom du livre commence par un nombre
            ++index;
        }
        // tant que les éléments ne contiennent pas de nombre (auquel cas nous
        // sommes arrivés aux indexes de chapitre)
        while (index < pieces.length && !(/[0-9]/.test(pieces[index]))) {
            ++index;
        }
        bookName = pieces.slice(0, index).join(" ");
        if (!this.chekBookName(bookName)) {
            console.error('unknown book name "'+bookName+'"');
            return false;
        }
        this.book = bookName;
        /* Chapitre
         */
        if (index == pieces.length) {
            // la référence ne contenait que lo nom du livre
            return true;
        }
        pieces = pieces[index].split(".");
        // L'indexe des chapitres est donné seul
        if (!this.extractRange(pieces[0], this.chapterRange)) {
            console.error('bad chapter range "'+pieces[0]+'"');
            return false;
        }
        // L'indexe des chapitres est donné avec l'index des versets
        if (pieces.length > 1) {
            if (!this.extractRange(pieces[1], this.verseRange)) {
                console.error('bad verse range "'+pieces[1]+'"');
                return false;
            }
        }
        return true;
    };
}
