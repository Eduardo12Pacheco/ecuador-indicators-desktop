# Third-party notices

Ecuador Indicators is MIT licensed (see `LICENSE`). It redistributes the
following third-party data and assets.

## Data: World Bank World Development Indicators

The bundled snapshot republishes a subset of the World Bank's World Development
Indicators (WDI), source id 2, retrieved through the World Bank Indicators API
v2 (`https://api.worldbank.org/v2`).

- Publisher: The World Bank.
- Licence: Creative Commons Attribution 4.0 International (CC BY 4.0),
  <https://creativecommons.org/licenses/by/4.0/>.
- Terms: <https://datacatalog.worldbank.org/public-licenses>.
- Dataset: <https://datacatalog.worldbank.org/search/dataset/0037712/world-development-indicators>.

Changes made by this project: the data is subset to 38 indicators and seven
geographies, translated names and notes are taken from the World Bank's Spanish
API, values are reorganized into an SQLite snapshot, and the application derives
year-over-year change, indexing and CAGR at display time. Underlying data
providers are credited per indicator in the `source_org_en` and `source_org_es`
fields and shown in the application's Data & About screen. The full attribution
texts stored in the snapshot are:

> Source: The World Bank, World Development Indicators (WDI), licensed under
> CC BY 4.0. Retrieved {date} through the World Bank Indicators API v2.
> Underlying data providers are credited per indicator. Spanish names and notes
> are provided by the World Bank; derived values (year-over-year change, index,
> CAGR) are computed by this application.

> Fuente: Banco Mundial, Indicadores del Desarrollo Mundial (WDI), licencia
> CC BY 4.0. Obtenido el {date} mediante la API de Indicadores del Banco Mundial
> v2. Los proveedores subyacentes de datos se acreditan por indicador. Los
> nombres y notas en español son provistos por el Banco Mundial; los valores
> derivados (variación año a año, índice, CAGR) son calculados por esta
> aplicación.

## Fonts: Inter, Fraunces and JetBrains Mono

The application vendors the latin subsets of Inter Variable, Fraunces Variable
and JetBrains Mono Variable from Fontsource 5.3.0. All three are licensed under
the SIL Open Font License 1.1. The license texts are copied next to the font
files (`src/ui/design/fonts/LICENSE-*.txt`) by `npm run fonts:sync`; the notice
is completed with the font files in the design-system task.
