/**
 * Concordance biblique intégrant un outil de recherche et le dictionnaire
 * "Le Littré".
 * 
 * Fichier dédié à la gestion du protocole applicatif (recherche de définition).
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
 * Procède à une demande de définition dans le dictionnaire.
 */
 
function requestServerForDictionnary(word)
{
    if (!s) return;
    var dict = {
        "now": new Date().getTime(),
        "tok": "dictionnary",
        "word": word
    };
    var jsonData = JSON.stringify(dict);
    s.send(jsonData);
}


/*
 * Fonction de manipulation des réponses du serveur concernant les recherches
 * dans le dictionnaire.
 */

function handleDictionnaryResponse(dom)
{
    var root = dom.documentElement;
    var entries = root.getElementsByTagName("entree"), entry, entryOl, table,
        tbody, corps;
    for (var i=0; i < entries.length; ++i) {
        entry = entries[i];
        table = termeModelTable.cloneNode(true);
        tbody = table.tBodies[0];
        // TODO ajouter un titre de table avec <thead> (sens n°1,2,etc...)
        handleEntete(
            entry.getAttribute("terme"),
            entry.getElementsByTagName("entete")[0],
            tbody
        );
        corps = entry.getElementsByTagName("corps")[0];
        handleVariantes(
            corps.getElementsByTagName("variante"),
            tbody
        );
        // Vide premièrement la section puis ajoute la nouvelle définition
        dictionnarySection.clear();
        dictionnarySection.appendChild(table);
    }
    showDictionnaryTab();
}

/*
 * Effectue une correspondance entre l'entête d'une entrée du XMLittré et une
 * table HTML de présentation, représentée ici par son corps "tbody".
 * Le terme de l'entrée est donné en premier argument (chaîne de car.)
 */

function handleEntete(terme, entete, tbody)
{
    var termeRow  = tbody.getElementsByClassName("terme")[0];
    var natureRow = tbody.getElementsByClassName("nature")[0];
    var prononRow = tbody.getElementsByClassName("prononciation")[0];
    var termeCell = termeRow.getElementsByTagName("td")[1];
    var natureCell = natureRow.getElementsByTagName("td")[1];
    var prononCell = prononRow.getElementsByTagName("td")[1];
    termeCell.appendChild(document.createTextNode(terme));
    prononCell.appendChild(entete.getElementsByTagName("prononciation")[0].firstChild);
    natureCell.appendChild(entete.getElementsByTagName("nature")[0].firstChild);
    termeRow.classList.remove("gone");
    prononRow.classList.remove("gone");
    natureRow.classList.remove("gone");
}

/*
 * Parcours les variantes d'une entrée et les représente au sein d'une table,
 * représentée ici par son corps "tbody".
 */

function handleVariantes(variantes, tbody)
{
    var varRow = tbody.getElementsByClassName("variantes")[0];
    var varCell = varRow.getElementsByTagName("td")[1];
    var olVar = document.createElement("ol"), liDef;
    var label;
    var indentsUl, indentLi, cits, citsUl;

    olVar.classList.add("variante");
    
    // Boucle sur les variantes de la définition
    for (var i=0, variante; i < variantes.length; ++i) {
        variante = variantes[i];
        liDef = document.createElement("li");
        
        // Le libellé de la variante peut être contenu dans un ensemble de
        // noeuds et de noeuds texte, situés les uns derrière les autres
        label = getRootText(variante, ["semantique"]);
        liDef.appendChild(document.createTextNode(label));

        // Traite les éventuelles citations
        cits = getCitations(variante);
        if (cits.length > 0) {
            citsUl = document.createElement("ul");
            for (var j=0, citLi; j < cits.length; ++j) {
                citLi = cits[j];
                citsUl.appendChild(citLi);
            }
            liDef.appendChild(citsUl);
        }

        // Récupère les indentations
        indentsUl = handleIndents(variante);
        if (indentsUl) {
            liDef.appendChild(indentsUl)
        }

        // Active le dépliement des sous-listes
        liDef.addEventListener("click", function(e) {
            // N'admet de basculer le pliage que sur le clic du <li>
            if (e.target != this) return;
            this.classList.toggle("unfolded");
        }, false);

        olVar.appendChild(liDef);
    }
    
    varCell.appendChild(olVar);
    if (variantes.length > 0) {
        varRow.classList.remove("gone");
    }
}

/*
 * Gestion des "indent", à savoir la structure de la définition
 */

function handleIndents(parent)
{
    var indent;
    var xpr = document.evaluate(
        "./indent",
        parent,
        null,
        XPathResult.ORDERED_NODE_ITERATOR_TYPE,
        null
    );
    var indentsUl = null, indentLi, cits, citsUl;
    do {
        indent = xpr.iterateNext();
        if (indent) {
            if (!indentsUl) {
                indentsUl = document.createElement("ul");
                indentsUl.classList.add("indent");
            }
            indentLi = document.createElement("li");
            // Obtient uniquement le texte à la racine
            indentLi.appendChild(document.createTextNode(getRootText(indent)));
            // Traite les éventuelles citations imbriquées
            cits = getCitations(indent);
            if (cits.length > 0) {
                citsUl = document.createElement("ul");
                for (var i=0, citLi; i < cits.length; ++i) {
                    citLi = cits[i];
                    citsUl.appendChild(citLi);
                }
                indentLi.appendChild(citsUl);
            }
            // Ajoute l'indentation à la liste
            indentsUl.appendChild(indentLi);
        }
    }
    while (indent);
    return indentsUl;
}

/*
 * Récupère la concaténation des noeuds texte situés à la racine d'un élément.
 * Conçu pour remplacer "element.textContent", qui est récursif.
 */

function getRootText(element, allowedTags)
{
    var xpathExpr = "./text()";
    // Ajoute une liste de tags à inspécter depuis la racine
    if (allowedTags) {
        xpathExpr = "("+xpathExpr;
        for (var i=0; i < allowedTags.length; ++i) {
            xpathExpr += "| ./"+allowedTags[i]+"/text()";
        }
        xpathExpr = xpathExpr+")";
    }
    var xpr = document.evaluate(
        xpathExpr,
        element, 
        null,
        XPathResult.ORDERED_NODE_ITERATOR_TYPE,
        null
    );
    var tmp;
    var text = "";
    do {
        tmp = xpr.iterateNext();
        if (tmp) {
            text += tmp.nodeValue.replace(/\n+/g, " ");
        }
    }
    while (tmp);
    return text;
}

/*
 * Retourne un noeud HTML <li> bâti à partir d'une citation
 * d'une entrée.
 */

function buildCitation(cit)
{
    var li, u, q, aut, ref, txt;
    
    aut = cit.getAttribute("aut");
    ref = cit.getAttribute("ref");
    txt = cit.textContent;

    li = document.createElement("li");
    
    if (aut) {
        li.appendChild(document.createTextNode(aut));
    }
    if (ref) {
        if (aut) {
            li.appendChild(document.createTextNode(", "));
        }
        u = document.createElement("u");
        u.appendChild(document.createTextNode(ref));
        li.appendChild(u);
    }
    
    if (aut || ref) {
        li.appendChild(document.createTextNode(" : "));
    }

    if (txt) {
        q = document.createElement("q");
        q.appendChild(document.createTextNode(txt));
        li.appendChild(q);
    }

    return li;
}

/*
 * Retourne une liste de noeuds <li> représentant les citations
 * trouvées dans le noeud parent.
 */

function getCitations(parent)
{
    var listElements = [];
    var xpr = document.evaluate(
        "./cit",
        parent,
        null,
        XPathResult.ORDERED_NODE_ITERATOR_TYPE,
        null
    );
    var cit, li;
    do {
        cit = xpr.iterateNext();
        if (!cit) continue;
        li = buildCitation(cit);
        listElements.push(li);
    }
    while (cit);
    
    return listElements;
}
