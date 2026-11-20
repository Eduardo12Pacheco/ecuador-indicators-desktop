# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Entries are generated from Conventional Commits with git-cliff.
## [0.1.0] - 2026-11-20

### Bug Fixes

- **ci**: Use the available setup-uv major ([4e1da1e](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/4e1da1eeb08ad43c969851d5a85ea7b7983cd964))

- **ui**: Resolve default-state and accessibility defects found by e2e ([0983f15](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/0983f158b8fab66234dcb1579146b8abc68016ad))

- **app**: Keep the design gallery out of capture builds ([9fc110a](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/9fc110a3acbf9722d106a6c9b89fd603b598e141))

- **shell**: Find bundled resources in installed linux layouts ([45db364](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/45db364b0345324c26d5671a2d838fed45670aa6))


### Documentation

- Add ADR template and stack decision ([11e8093](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/11e8093dbf99fc8b5732a86fbfbd9d0093d2afa8))

- Add data guide, lakehouse manifest and ADRs 0002 and 0009 ([f71865a](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/f71865a50326c15e9cbbdb8cfcfdd830a04f031e))

- **pipeline**: Document the pipeline commands ([a3bde11](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/a3bde110f30ecb9c757801e4fd96f0a006398fc1))

- Add ADRs 0003 and 0004 ([c095fca](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/c095fca66e71893c80b2b2898a9031ee20305288))

- Add design guide skeleton and ADR 0005 ([717c801](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/717c8013bb69a63dd1216ec4b25a9c924bfa2bb4))

- Add ADR 0006 and chart design guidance ([8db70e8](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/8db70e80f232624e263410bc0e27b810ed15bb94))

- Add testing guide and ADR 0007 ([2abfa6f](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/2abfa6ff482300e77aef9e12a37e927d03a965de))

- **media**: Add screenshots and hero gif ([4eaf310](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/4eaf3106b9a408123b1b532547208cd96059d4cf))

- **readme**: Add ci status badge ([b15b424](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/b15b424ccaa9185b21db17423ad2a72422870a33))

- Add install and releasing guides and ADR 0008 ([f0020b5](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/f0020b5622b96768645166fc91d53e1e77bbe066))

- Add architecture guide ([f64db17](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/f64db174ab13762576ff3c5a7c5e5b0ce9579692))

- Add readme in english and spanish ([b0ac49f](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/b0ac49fd8d1139fb59d83ea9d471a45d1ddd51a1))

- Add contributing, security and notices ([fd1a440](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/fd1a4407860108bffa3a9be0d3efa70b25d84446))

- Finalize design, testing and adr closure ([e7fd0ca](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/e7fd0ca1fcf1238465233d266e84932201444a2d))

- Record the measured bundle size ([c72e5cd](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/c72e5cd97c911f454e019004db6bd65716599ea5))

- Document the typed environment settings ([2854f4a](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/2854f4af4af8d5908466ae248626d6050191a96d))


### Features

- **pipeline**: Add curated indicator catalog ([773aa90](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/773aa90d69b80fa506290f26856e312a14088c45))

- **pipeline**: Add domain models, catalog loader and typed errors ([01b22a8](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/01b22a83e00d89cf7a63a91de814fbf6c62a8f0a))

- **pipeline**: Add canonical json and logical hash ([ef6bb32](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/ef6bb326feae3ae7d3efc41d5ed3c76245eb6705))

- **pipeline**: Add ports, settings and structured logging ([b1a10b2](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/b1a10b2419fd49b7b7b30d890ce08eb519b732bc))

- **pipeline**: Add world bank source adapter with retries ([75b7b4b](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/75b7b4b6b61f708c43bad84c0ca9df512bba5ff6))

- **pipeline**: Add raw cache and data manifest ([58f0db4](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/58f0db4c7b348f15b46434531de082b2188ecef7))

- **pipeline**: Add sqlite snapshot writer and reader ([3c38606](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/3c3860653aaffd1a69101a13cb9f1a3c209ffe7a))

- **pipeline**: Add refresh use case ([4b5da77](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/4b5da77579bc4884e51b8ca49b07a86571c9da69))

- **pipeline**: Add deterministic build use case ([3dc0fc4](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/3dc0fc4d8e37dcdab1cdfda2119d7cc5a31ead52))

- **pipeline**: Add verify use case and cli commands ([4ee44f6](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/4ee44f6fafe9e7eef2c362cb3cca4fc2e1377d8a))

- **pipeline**: Add lakehouse manifest contract and duckdb adapter ([df4c20a](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/df4c20a678573f8d2c643f11ddbb68b4e0d26581))

- **pipeline**: Add json export, mini subset and spanish metadata fallback ([5246ab1](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/5246ab1b82e9c861af685543db44927d02cb0918))

- **data**: Add world bank raw cache and full snapshot ([5793c00](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/5793c007b2456d150f4d0a00a8c112b63f5e7598))

- **core**: Add domain types and ports ([e46db4c](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/e46db4c3e1a5b9979458d9090f62ba67d6d066bc))

- **core**: Add dataset, view, settings, export and update services ([579ed1d](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/579ed1d67841256ce1a7aa8e086c22e03597c2e4))

- **core**: Add sqlite, http and filesystem adapters ([6410288](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/641028847edee9f22f61f0dbd243f6fa44713dfe))

- **core**: Generate typescript bindings ([2d31e44](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/2d31e446a34f9e9a28643cfcb8626535699622be))

- **shell**: Add typed app config, logging and cli parser ([7b76a67](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/7b76a670866c9ffca9a9879cd0808572b2ebed97))

- **shell**: Add the fourteen ipc commands and app state ([8778da0](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/8778da0cd22a1346d3c5936967a51aa1bc5c5b9d))

- **shell**: Add headless self-check report ([d6ebb26](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/d6ebb26552dab2ab9bf10740c51ffcc0e9db638d))

- **shell**: Add the composition root and main window setup ([8ad8e0a](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/8ad8e0ab69ec3527e47b169bfa50c2a2e67caa72))

- **shell**: Add csp, minimal capabilities and platform icons ([025d53d](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/025d53d62f45496957ed4a9b561dc8eb01c503a5))

- **core-ts**: Add result, errors and branded domain model ([1ed75af](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/1ed75afc66d2b5dfe3bc9bc99553f028da25a06f))

- **core-ts**: Add series transforms and summary statistics ([0887c3d](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/0887c3dd7b20e2fc36c2d64f446bf84ab19ea20a))

- **core-ts**: Add locale-aware formatting and csv export ([af3c039](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/af3c039ff33c5306f40061aa2c58a3af2fd77e81))

- **core-ts**: Add ranked diacritic-insensitive catalog search ([9897176](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/98971765ee70b6f87e5c586ec6447638312b7aee))

- **core-ts**: Add sanitized explore url state ([c0ab9f5](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/c0ab9f5eb19bf8d38da4f7fe4dbec6399c0527d7))

- **core-ts**: Mirror saved-view validation ([9f9b53c](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/9f9b53c6dc3bedd8f9b8a50d09025c662187ef12))

- **core-ts**: Add application ports and data use cases ([43c8ed3](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/43c8ed35a6d5b5fd146e342d49a1fa2153ac596f))

- **core-ts**: Add zod contracts for every ipc payload ([4bd46c7](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/4bd46c7fef32de0e02cb8ab88f312d058e4f58c3))

- **adapters**: Map tauri wire dtos into the branded domain ([1913cb5](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/1913cb5a83994e49833865cfc131ecfdfcda94b0))

- **adapters**: Add the typed tauri gateway ([63cae17](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/63cae1719586191e5cc6128d644e85409dd6a55f))

- **adapters**: Add in-memory gateway, cache and fault injection ([4a27fba](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/4a27fbac28b68bdbdab9b9d6c69df6e4a984798f))

- **i18n**: Add typed english and spanish dictionaries ([31a0067](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/31a00671571e4592ac0c165a5f818fb9ebd12012))

- **i18n**: Add language provider and translation hook ([d71cac2](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/d71cac2741c67f5fc88fda1efbfd110dbde479a8))

- **ui**: Add design tokens, fonts and base styles ([167b027](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/167b0271c102b86c7a77fb289e7e30d4e95c3c73))

- **ui**: Add theme mechanics and provider ([99edf42](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/99edf42d7cad8b0980f0772cf2a02d8aca1671c5))

- **ui**: Add buttons, cards and keyboard hints ([56264f9](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/56264f9ba0344572ed328be595feb326c068539a))

- **ui**: Add feedback and display primitives ([a4ce976](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/a4ce976f6abf608f67376a37116a4297ab158763))

- **ui**: Add tabs, tooltip and dialog primitives ([38d7115](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/38d7115da8ae01ad0d74ad9f1885f39aa690e9a5))

- **ui**: Add switch, slider and segmented controls ([26934b7](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/26934b75c7bd6feafe442ceb7f54ca75634fc653))

- **ui**: Add the polite toast region ([7340ca6](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/7340ca67e32bfcd5d78dde43c602fc772e035f01))

- **app**: Add shell landmarks, sidebar and status bar ([3c32b2c](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/3c32b2c698811e52671cbe740b441677964d8808))

- **app**: Add top bar appearance controls ([f51e6ba](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/f51e6ba80176b1b7e7910046b77ba42942848e60))

- **app**: Add ports context, providers and first-paint bootstrap ([c7ef686](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/c7ef68687a1676f3687a2289c2481a1b23ac0a78))

- **app**: Add router and placeholder pages ([16c3a19](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/16c3a1952c6bd324cfea9ea88d847254fa1d0c0c))

- **ui**: Add the design gallery ([0f6862b](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/0f6862b2d06adcd5d11d9d1b23787d18966e8b5f))

- **app**: Wire the composition root and root providers ([e2ba895](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/e2ba895add5d5c383cfc618769ad65c32a20ab89))

- **charts**: Add chart renderer port and echarts adapter ([013da00](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/013da007e7840a1d92b1a690ada431b7edd74da8))

- **charts**: Add stable series styling and token theme resolution ([160e9c1](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/160e9c179105f3f1fd5ddc56eed75586efe44756))

- **charts**: Add pure option builder and png export ([0ead898](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/0ead89894fab37fe94bdd6fa38ea523197636f0c))

- **charts**: Add keyboard scrubbing and accessible canvas ([4121aca](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/4121acaa808f82b2c59c463af735dfaa91bb0d67))

- **explore**: Add catalog panel and indicator header ([3d02181](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/3d021811818fd8be46a15e61f02f7e3c486c8a42))

- **explore**: Add kpi cards and year range controls ([0e63759](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/0e6375996a7d31d36e01e710e3baed9751e86690))

- **explore**: Add transform, peers and chart type controls ([a1440b1](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/a1440b1a34dd94993fe90b302c9f704907b3c06c))

- **explore**: Add data table and loading empty error states ([b599cc4](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/b599cc46899f257f5038fadff86a00af4e838c21))

- **explore**: Wire url state, chart, data table and controls ([be8c376](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/be8c376cbfcecd7cc06b84b77ceffb80679c3a2e))

- **compare**: Add url state and ranking year helpers ([893ccdd](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/893ccddb78a34b797a97e50c544eb9139709f2bd))

- **charts**: Add compare chart option builders ([52ac1fa](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/52ac1fa099e81a7d5977a9e420c2c807ba5f5152))

- **compare**: Add compare controls and states ([a6da180](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/a6da180de701c4730b0a64ff53ae1964673affcb))

- **compare**: Add trajectories tab with base-year indexing ([a7a557c](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/a7a557cf45a00f72657b4835a25eb3679eba76ca))

- **compare**: Add ranking tab and table ([67e07f6](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/67e07f69e5e8a2937c2614904c85ca064a8fadfb))

- **app**: Add command registry and shortcut normalization ([61e60f3](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/61e60f360d0753af61567918bea22e2ed5b09eac))

- **app**: Add global shortcut handling with chords ([1b9ca2c](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/1b9ca2c2472d3a1fd78dadffd09f95cc981d9fbf))

- **palette**: Add grouped palette data and view routing ([9163287](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/9163287a87676056c3d8f6638f6e0484369d2891))

- **palette**: Add command palette and shortcut help ([407bfd3](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/407bfd370b8acf6d5c7db082540009aa059343c4))

- **app**: Wire palette and shortcuts into the shell ([123a132](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/123a13289e5233ea9f7df67a7d89f2755d0c9e9f))

- **views**: Add view location round-trip helpers ([86ce0fd](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/86ce0fde03daadfc1b178dfe54859bccbbd2e631))

- **adapters**: Add native save, snapshot picker and external links ([f9b973f](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/f9b973fe9f9a1366e643178f8cf7ca1e90f23716))

- **views**: Add save view dialog and view summaries ([f81f97d](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/f81f97d087b725c0e144a919edb73e98ff46089c))

- **views**: Add saved views page with open rename and delete ([9b2d064](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/9b2d064454b4884df5a0d660dcbaf7f30b0859b9))

- **export**: Add csv and png export with shell commands ([b916ac6](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/b916ac6eab257bada8da804ae8f31ff6052bc5ca))

- **settings**: Add appearance, updates and dataset sections ([6cddccf](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/6cddccfca906fa24158ef98fcb4e621e4bf26eef))

- **about**: Add data provenance, notices and snapshot recovery ([8dd1b2b](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/8dd1b2b9bf6037d3b7b9e1927f80392f3ffc19a7))

- **media**: Add full-snapshot capture project and gif builder ([f7e23a4](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/f7e23a4375d15f61bcd7af6300f02c3d0d6a592f))


### Maintenance

- Scaffold repository tooling and license ([92b875d](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/92b875d5d1204eeea4358a5b17eea57f09b55ef1))

- **tauri**: Add tauri 2 shell with vite react frontend ([5ae2167](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/5ae2167e88b61b4c31fe42853cf7b792323a30f8))

- **pipeline**: Add python project skeleton ([2f3d262](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/2f3d262d24cc7a95cbc3aa48465695edf23ae17a))

- Add lint and test workflow skeleton ([63e5a7a](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/63e5a7aa04182eb22544b5dcc8fd664ca3473979))

- **pipeline**: Add runtime dependencies and import contracts ([9541e5c](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/9541e5caf479704d3bf9494850e249bcd2d5a60a))

- Add data core dependencies, fixture scripts and coverage gates ([9b77a82](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/9b77a825a87a15145ac90f482c93bb2fc861517b))

- Add ui, i18n and testing dependencies ([cbedab5](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/cbedab512966026445ebdf100823e78fed59d876))

- Add production license check script ([1c4739e](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/1c4739e13c135d99ee854178d963b9e5849655cc))

- Add version sync check ([794eb61](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/794eb61f19ea3fe1bc76894f3973e8a6e5b77c74))

- Add bundle size check ([ad7ff99](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/ad7ff995a33cca3dcd53f0d79a08a6e9712af8c2))

- Add bindings drift check ([98949fd](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/98949fd3b0e1efd84b94691960ab12a2d344b0c2))

- Add self-check assertion ([aaa15a8](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/aaa15a8c98b9ec1ab474cff58dd1b8e5c0d3a984))

- Add composite toolchain setup action ([7d088a4](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/7d088a44c0d05b9de3b0cab1e7a58ea2b7a6153b))

- Add full matrix, e2e, audit and quality jobs ([e05d00b](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/e05d00b7444a4e99a3aaab1e1bd0c9dd413371c0))

- Add cargo deny configuration ([5cd6196](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/5cd6196f1fd2103362ff0f86241ba4518f50f57a))

- Add artifact collection and version bump scripts ([e7fcd06](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/e7fcd064c9db91e7deb3dd1e169e5223bee9ea73))

- Add git-cliff changelog configuration ([2eef383](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/2eef383797b56b56378486e63d91e8ed3a3c1b97))

- **release**: Add tag-driven 3-os build workflow ([c79f7d0](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/c79f7d04e455f7093e782dbae7bdca004ee7986c))

- **release**: Add installer smoke tests and publish job ([196df6f](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/196df6fa7e52cdf69b41a9595b660ccea12abe8d))

- **release**: Exclude the checksum file from its own input ([4085c29](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/4085c2953e695ea1f3a0df80d8e6f61276d6d95f))

- Add metrics script and documentation checks ([eca3379](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/eca3379c2c6b1c30face29a433d544bfae5654df))

- **release**: Generate initial changelog ([2b4611c](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/2b4611c29daa3b4965d7859838f494bc5d01ff86))


### Tests

- **pipeline**: Add recorded world bank fixtures and adapter tests ([6265a3f](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/6265a3fa4e55871855ec62fba913b7e9ff2aca31))

- **pipeline**: Add reproducible mini raw fixture and snapshot ([1745450](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/1745450e745c99e9859967eacedb0a7c17b07cfe))

- **pipeline**: Add fixture tooling and shared helpers ([430c3f0](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/430c3f0324ffa305701e05f90793082271e299b4))

- **pipeline**: Add model and catalog tests ([c709336](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/c709336e98903ab2a654c5b47d0a89eec50cbea9))

- **pipeline**: Add logical hash property tests ([aaade58](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/aaade5867e3ce0b07f3e4a65e51db24dbb7b76a5))

- **pipeline**: Add settings, logging and raw cache tests ([c302f13](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/c302f13d0d7997369c122a4598023fc2e1b0d3db))

- **pipeline**: Add refresh and build use case tests ([6e5e95b](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/6e5e95b742fbb5b43b69344b35af5be1ab90beb1))

- **pipeline**: Add verify and cli tests ([ccc31ef](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/ccc31efb1f0257e4462d797ab44ea0ef5d4cc8ff))

- **pipeline**: Add snapshot integration and end-to-end tests ([12ab463](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/12ab4636c08957e49fa48af512e672757028bfa8))

- **pipeline**: Add observation round-trip and byte mutation properties ([58a07ec](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/58a07ec85caa4f4f400990a63afe6f48d9627bb1))

- **pipeline**: Add lakehouse manifest and duckdb import tests ([3771586](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/3771586a2bbc1fbbf071efd89fab261ebf6b3b8e))

- **core**: Add service, snapshot and adapter contract tests ([d8b42e8](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/d8b42e82758ec56b4cde5adb536dd34f560b7e59))

- **core**: Add property and architecture tests ([90db094](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/90db0947f60cf68aeaab6fa64135d821a3cd61f6))

- **core**: Cover the public API surface ([5816684](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/581668460302ab4e0e0b42d0da89a379a81ee10c))

- **shell**: Cover the ipc command surface ([cf52425](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/cf52425efb756a7601f9a6cc73e9dbb1ced18df3))

- **core-ts**: Cover the use cases through the memory gateway ([485f804](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/485f8045440345524be89ad6ef21aa748e00dd27))

- **adapters**: Cover the in-memory gateway and decorators ([d9badeb](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/d9badebd65e653ee176884840c4550328451a769))

- Enforce typescript dependency rules and cover the composition root ([ef23989](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/ef2398901610d2887bf99b0a2d4115cdf470a9ab))

- **ui**: Add the design token contrast contract ([279c3b5](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/279c3b59cfcbc08acb0fb324d0d73d740afa2fc1))

- **app**: Cover shell landmarks, appearance and accessibility ([081f4a1](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/081f4a13451fbf46ff0dfce71447e06fea355380))

- Allow presentation libraries in the ui layer ([87f8988](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/87f8988f27e8dc6124269ee87997851bc073fe4c))

- **e2e**: Add playwright setup and support helpers ([0cfc2f7](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/0cfc2f7b39eb88c9fc85995f6a1c1886b1a4c544))

- **e2e**: Add explore, compare and palette flows ([d62446b](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/d62446b5b3fe9ddff1a541286944c9fba147665b))

- **e2e**: Add views, export, settings, states and keyboard flows ([4538866](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/453886679bad6e46ef13c1230d6e2a5d78a85c90))

- **a11y**: Add axe scans across routes, themes and languages ([a51a992](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/a51a992fbed633f117e804a391cde47b552bd0dc))

- **native**: Add webdriver e2e suite and test ids ([e6a3df0](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/e6a3df0254bf2e46eb2fa1650c924bb9b0b2337c))

- **e2e**: Assert the explore route before the save shortcut ([78f94fc](https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/commit/78f94fcab114079ccf023b77652a053e846d7af5))


