/**
 * Concordance biblique intégrant un outil de recherche et le dictionnaire
 * "Le Littré".
 * 
 * Fichier dédié à la gestion du protocole applicatif (recherche dans la bible).
 * 
 * Copyright 2013 Houillon Nelson <houillon.nelson@gmail.com>
 * 
 *  This program is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation; either version 2 of the License, or
 *  (at your option) any later version.
 * 
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *  GNU General Public License for more details.
 * 
 *  You should have received a copy of the GNU General Public License
 *  along with this program; if not, write to the Free Software
 *  Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston,
 *  MA 02110-1301, USA.
 */

/* 
 * Envoi une requête de recherche de versets.
 */

function requestServerForSearch()
{
    if (!s) return;
    saveFormState();
    var dict = {
        "now": new Date().getTime(),
        "ref": [],
        "tra": filterForm.elements["traduction"].value,
        "bou": filterForm.elements["mot"].checked,
        "cas": filterForm.elements["case"].checked,
        "acc": filterForm.elements["accent"].checked,
        "tok": "search"
    };
    lastTranslationUsed = filterForm.elements["traduction"].value;
    var allWords   = filterForm.elements["conjonction"].value;
    var oneOfWords = filterForm.elements["quelconque"].value;
    var noneWords  = filterForm.elements["aucun"].value;
    var exactExpr  = filterForm.elements["expression"].value;
    var numLow     = filterForm.elements["nombres_min"].value;
    var numHigh    = filterForm.elements["nombres_max"].value;
    if (allWords.length) {
        dict["all"] = allWords.split(/\s+/).filter(ret);
    }
    if (oneOfWords.length) {
        dict["one"] = oneOfWords.split(/\s+/).filter(ret);
    }
    if (noneWords.length) {
        dict["non"] = noneWords.split(/\s+/).filter(ret);
    }
    if (exactExpr) {
        exactExpr = exactExpr.replace(/\s+/g, " ").replace(/^ /, "").replace(/ $/, "");
        if (exactExpr) {
            dict["exp"] = exactExpr;
        }
    }
    if (numLow) {
        var ranDict = {"l": numLow};
        if (numHigh) {
            ranDict["h"] = numHigh;
        }
        dict["ran"] = ranDict;
    }
    for (var r in selectedReferences) {
        dict["ref"].push(r);
    }
    var jsonData = JSON.stringify(dict);
    s.send(jsonData);
}


/*
 * Fonction de manipulation des réponses du serveur concernant les recherches.
 */

function handleSearchResponse(res)
{
    cleanSearchList();
    for (var i=0, ref; i < res.length; ++i) {
        ref = res[i];
        addVerseToSearchList(ref["ref"], ref["verse"]);
    }
    toggleCleanButton();
}
