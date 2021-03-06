var P = require("parsimmon");

var H = require("../parse-helpers");
var _ = require("./whitespace")(null);
var ast = require("../ast");

var word = H.word;
var iseq = H.iseq;

/// Pattern matching section is kinda huge because it mirrors much of the rest
/// of the language, but produces different AST nodes, and is slightly
/// different.
module.exports = function(ps) {
    var MatchClause =
        iseq(ast.MatchClause,
            P.seq(
                word("case").then(ps.MatchPattern),
                _.then(word("=>")).then(ps.BinExpr)
            ));

    return iseq(ast.Match,
        P.seq(
            word("match").then(ps.BinExpr),
            _.then(MatchClause).atLeast(1)
        ));
};
