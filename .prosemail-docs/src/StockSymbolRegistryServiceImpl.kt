package com.prosemail.docs

/**
 * Stock symbol registry for the Prosemail docs surface.
 *
 * Categories mirror the current exposed finance surfaces: equities and indices,
 * stocks, crypto, commodities, forex, bonds, options, and macro. The first-class
 * math-entity surface (matric) is surfaced here as well so its symbols appear
 * alongside the finance categories in the same insert palette.
 */
class StockSymbolRegistryServiceImpl : StockSymbolRegistry {

    override fun getStockCategories(): List<String> {
        return listOf(
            "Equity",
            "Equity (Usd)",
            "Indices",
            "Stocks",
            "Crypto",
            "Commodities",
            "Forex",
            "Bonds",
            "Options",
            "Macro",
            "matric",
            "matric.literal",
            "matric.Array",
            "matric.Text",
            "matric.Textual"
        )
    }

    override fun getSymbolsForCategory(category: String): List<StockSymbol> {
        return when (category) {
            "Equity" -> emptyList()
            "Equity (Usd)" -> emptyList()
            "Indices" -> emptyList()
            "Stocks" -> emptyList()
            "Crypto" -> emptyList()
            "Commodities" -> emptyList()
            "Forex" -> emptyList()
            "Bonds" -> emptyList()
            "Options" -> emptyList()
            "Macro" -> emptyList()
            "matric" -> emptyList()
            "matric.literal" -> emptyList()
            "matric.Array" -> emptyList()
            "matric.Text" -> emptyList()
            "matric.Textual" -> emptyList()
            else -> emptyList()
        }
    }

    override fun getAllSymbols(): List<StockSymbol> = emptyList()
}
