// Curriculum content for the Full-Stack Mastery Path (extracted from the original prototype).
function code(lang,raw){return {lang,raw};}
function L(t,pts,sub,pr){return {t,pts,sub:sub||"",pr:pr||null};}

export const DATA=[
{track:"foundations",title:"Foundations & Tooling",phase:"PHASE 01",color:"#5fb3c4",
 desc:"Before any framework: the command line, version control, how the web actually works, and core programming sense.",
 modules:[
  {t:"Dev Environment & CLI",lessons:[
    L("Command Line Basics",["Navigation: cd, ls, pwd, mkdir, rm, cp, mv.","Pipes & redirection: |, >, grep, find.","Permissions, env vars, PATH."],"shell types (bash/zsh) · cd/ls/pwd · mkdir/rm/cp/mv · cat/less/head/tail · grep · find · pipes | · redirection > >> · wildcards * ? · chmod/chown · environment variables · PATH · aliases · ssh/scp basics",["Find all .java files in a folder with one command.","Pipe ls into grep to filter by name."]),
    L("Git Fundamentals",["init, add, commit, status, log, diff.","Branching & merging; resolve conflicts.","rebase vs merge; stash; reset vs revert."],"git init · staging area · commit & messages · status/log/diff · branch · checkout/switch · merge · merge conflicts · rebase · stash · reset (soft/mixed/hard) · revert · tags · .gitignore · HEAD & refs",["Create a repo, make 3 commits, branch, merge.","Cause a conflict and resolve it."]),
    L("GitHub Workflow",["Remotes: clone, push, pull, fetch.","Pull requests, code review, issues.","Trunk-based vs git-flow; .gitignore."],"clone · remote/origin · push/pull/fetch · forks · pull requests · code review · issues & labels · branching strategies · protected branches · GitHub Actions intro · README/licenses",["Fork a repo and open a pull request.","Write a clear PR description."]),
    L("Package Managers & Build Tools",["npm/yarn: package.json, scripts, semver.","Maven/Gradle: dependencies, lifecycle, plugins.","Lockfiles & reproducible builds."],"package.json · npm install/run · semver ^ ~ · scripts · node_modules · lockfiles · Maven POM · Gradle build.gradle · dependency scopes · build lifecycle · plugins · repositories",["Add a dependency and run a custom npm script."]),
    L("IDE & Debugging",["VS Code / IntelliJ essentials & shortcuts.","Breakpoints, watch, step over/into.","Linting & formatting (ESLint, Prettier)."],"editor shortcuts · extensions · breakpoints · step over/into/out · watch & variables panel · call stack · conditional breakpoints · ESLint · Prettier · EditorConfig · debugger statement",["Set a breakpoint and inspect a variable mid-run."]),
  ]},
  {t:"How the Web Works",lessons:[
    L("HTTP & HTTPS",["Methods: GET POST PUT PATCH DELETE.","Status codes: 2xx 3xx 4xx 5xx.","Headers, cookies, TLS, CORS."],"request/response · methods GET/POST/PUT/PATCH/DELETE · status codes 2xx/3xx/4xx/5xx · headers · query vs body · cookies · caching headers · TLS/HTTPS handshake · CORS · content negotiation",["Inspect a request in DevTools Network tab.","Identify status code & headers of any site."]),
    L("Client–Server & DNS",["Request/response cycle; statelessness.","DNS resolution, IP, ports.","Browser rendering: HTML→DOM→paint."],"client-server model · statelessness · DNS lookup · IP & ports · TCP/UDP basics · URL anatomy · browser request flow · DOM construction · CSSOM · render tree · paint & reflow"),
    L("REST Principles",["Resources, representations, statelessness.","Idempotency & safe methods.","HATEOAS, proper status usage."],"resources & URIs · representations · statelessness · safe vs idempotent methods · proper status codes · HATEOAS · richardson maturity model · versioning"),
    L("Data Formats",["JSON structure & parsing.","XML/YAML basics; when each is used.","Serialization/deserialization."],"JSON syntax · objects/arrays/types · parse/stringify · YAML structure · XML basics · serialization · deserialization · schema validation · content types",["Hand-write a JSON object for a user with nested address."]),
  ]},
  {t:"Programming Sense",lessons:[
    L("Data Structures",["Arrays, lists, maps, sets, stacks, queues.","Trees & graphs (overview).","Choosing the right structure."],"arrays · linked lists · stacks · queues · hash maps · sets · trees · binary search trees · heaps · graphs · tries · choosing by access pattern",["Implement a stack using an array."]),
    L("Algorithms & Big-O",["Time/space complexity notation.","Search & sort fundamentals.","Recursion basics."],"Big-O notation · O(1)/O(n)/O(log n)/O(n²) · linear vs binary search · bubble/merge/quick sort · recursion · base case · iteration vs recursion · space complexity",["Reason about the Big-O of a nested loop."]),
    L("Clean Code & SOLID",["Naming, small functions, DRY.","SOLID principles with examples.","Refactoring smells."],"naming · small functions · DRY · KISS · single responsibility · open/closed · Liskov substitution · interface segregation · dependency inversion · code smells · refactoring"),
    L("Design Patterns Intro",["Creational/structural/behavioral overview.","Singleton, Factory, Strategy, Observer.","When NOT to use a pattern."],"creational/structural/behavioral · Singleton · Factory · Builder · Strategy · Observer · Decorator · Adapter · Dependency Injection · anti-patterns · overengineering"),
  ]},
 ]},

{track:"frontend",title:"Frontend Core",phase:"PHASE 02",color:"#d98cc4",
 desc:"The browser trio mastered before frameworks: semantic HTML, modern CSS layout, deep JavaScript, then TypeScript.",
 modules:[
  {t:"HTML & CSS",lessons:[
    L("Semantic HTML",["Document structure, landmarks, forms.","Semantic tags vs div soup.","Meta, links, scripts loading."],"document structure · head/body · semantic tags (header/nav/main/article/section/footer) · headings hierarchy · forms & inputs · labels · meta tags · linking CSS/JS · defer/async · entities",["Mark up an article page using only semantic tags."]),
    L("CSS Fundamentals",["Selectors, specificity, cascade, inheritance.","Box model, display, position.","Units: rem/em/%/vw."],"selectors · specificity · cascade · inheritance · box model · margin/padding/border · display (block/inline/flex/grid) · position (static/relative/absolute/fixed/sticky) · z-index · units px/rem/em/%/vw/vh"),
    L("Flexbox & Grid",["Flexbox: axis, justify, align, wrap.","Grid: template areas, fr, gaps.","When to use which."],"flex container/items · flex-direction · justify-content · align-items · flex-wrap · flex-grow/shrink/basis · grid-template-columns/rows · fr unit · grid-template-areas · gap · auto-fit/minmax · alignment",["Build a responsive card layout with Grid.","Center a box both ways with Flexbox."]),
    L("Responsive & A11y",["Media queries, mobile-first.","Fluid type & images.","ARIA, contrast, keyboard nav."],"media queries · breakpoints · mobile-first · viewport meta · fluid typography · clamp() · responsive images srcset · container queries · semantic markup · alt text · color contrast",["Make a layout work at 320px and 1440px."]),
  ]},
  {t:"JavaScript Deep",lessons:[
    L("Types, Scope, Closures",["Primitives vs objects; coercion.","var/let/const; hoisting; TDZ.","Closures & lexical scope."],"primitives vs reference · typeof · type coercion · == vs === · var/let/const · hoisting · temporal dead zone · function vs block scope · lexical scope · closures · IIFE",["Write a counter using a closure."]),
    L("Functions & this",["Arrow vs regular functions.","this binding, call/apply/bind.","Prototypes & inheritance."],"function declarations vs expressions · arrow functions · default/rest params · this binding rules · call/apply/bind · prototype chain · __proto__ · class syntax · inheritance · static methods"),
    L("DOM & Events",["Select, create, modify nodes.","Event bubbling/capturing, delegation.","preventDefault, stopPropagation."],"querySelector · createElement · appendChild · textContent/innerHTML · classList · dataset · addEventListener · event object · bubbling/capturing · delegation · preventDefault · stopPropagation",["Build a click-to-add todo list (no framework)."]),
    L("Async JavaScript",["Callbacks → Promises → async/await.","Event loop, microtasks, macrotasks.","fetch & error handling."],"callbacks · callback hell · Promises · then/catch/finally · Promise.all/race/allSettled · async/await · try-catch · event loop · call stack · microtask vs macrotask queue · fetch API",["Fetch from a public API and render the result.","Handle a rejected promise gracefully."]),
    L("Modern ES",["Destructuring, spread/rest, optional chaining.","Modules: import/export.","Map/Set, iterators, generators."],"destructuring · spread/rest · template literals · optional chaining ?. · nullish ?? · ES modules import/export · dynamic import · Map/Set · Symbol · iterators · generators · for...of"),
  ]},
  {t:"TypeScript",lessons:[
    L("Type System",["Primitives, arrays, tuples, enums.","Interfaces vs types; unions/intersections.","Type narrowing & guards."],"primitive types · arrays & tuples · enums · any/unknown/never · interface vs type · union & intersection · literal types · type narrowing · type guards · typeof/instanceof · discriminated unions",["Type a function that returns user or null."]),
    L("Generics & Utility Types",["Generic functions & constraints.","Partial, Pick, Omit, Record, Readonly.","keyof, typeof, mapped types."],"generic functions · generic constraints (extends) · default type params · Partial/Required/Readonly · Pick/Omit/Record · keyof · typeof · indexed access · mapped types · conditional types · infer"),
    L("Config & Decorators",["tsconfig strict mode.","Decorators (power Angular).","Declaration files & DefinitelyTyped."],"tsconfig.json · strict flags · target/module · paths · decorators · metadata reflection · declaration files .d.ts · DefinitelyTyped @types · module resolution · type-only imports"),
  ]},
  {t:"Web Platform Advanced",lessons:[
    L("Browser Storage",["localStorage/sessionStorage; cookies.","IndexedDB for structured data.","Cache API."],"localStorage · sessionStorage · cookies & attributes · SameSite · IndexedDB · object stores · Cache API · storage limits · when to use each"),
    L("WebSockets & Real-Time",["WebSocket API & events.","Server-Sent Events.","Polling vs push."],"WebSocket API · open/message/close/error · sending data · Server-Sent Events · EventSource · long polling vs short polling · reconnection · heartbeats"),
    L("PWA & Service Workers",["Service worker lifecycle & caching.","Offline-first; web manifest.","Push notifications."],"service worker registration · lifecycle (install/activate/fetch) · caching strategies · offline-first · web app manifest · installability · background sync · push notifications"),
    L("Web Components",["Custom elements & shadow DOM.","Templates & slots.","Framework interop."],"custom elements · lifecycle callbacks · shadow DOM · encapsulated styles · <template> · <slot> · attributes vs properties · framework interop"),
  ]},
  {t:"Styling at Scale",lessons:[
    L("CSS Animations & Transitions",["transition, transform, keyframes.","GPU & will-change performance.","prefers-reduced-motion."],"transition property/duration/easing · transform translate/scale/rotate · @keyframes · animation shorthand · GPU compositing · will-change · prefers-reduced-motion · performance"),
    L("Sass & Preprocessing",["Variables, nesting, mixins.","Partials & modules.","Functions & loops."],"variables · nesting · mixins & @include · @extend · partials · @use/@forward · functions · @if/@each/@for · maps · placeholders"),
    L("Tailwind CSS",["Utility-first workflow.","Config & theming.","@apply & component classes."],"utility-first concept · core utilities · responsive prefixes · state variants (hover/focus) · tailwind.config · theme extension · @apply · @layer · JIT engine · plugins"),
    L("CSS Architecture",["BEM, ITCSS, scoping.","Design tokens.","Taming specificity."],"BEM naming · ITCSS layers · SMACSS · CSS modules · scoping · design tokens · CSS custom properties · specificity management · utility vs component CSS"),
  ]},
  {t:"Accessibility (a11y)",lessons:[
    L("Semantics & ARIA",["Roles, states, properties.","When ARIA is needed (and not).","Accessible names & labels."],"semantic HTML first · ARIA roles · states & properties · aria-label/aria-labelledby · aria-live · landmarks · accessible name computation · when NOT to use ARIA",["Navigate a page using only a screen reader."]),
    L("Keyboard & Focus",["Tab order & focus traps.","Visible focus styles.","Skip links."],"tab order · tabindex · focus management · focus trap · visible focus styles · skip links · keyboard event handling · roving tabindex"),
    L("Visual & Cognitive",["Color contrast (WCAG AA/AAA).","Text resize & zoom.","Motion & readability."],"color contrast ratios · WCAG AA/AAA · text resize & zoom · reflow · prefers-reduced-motion · readable typography · don't rely on color alone · target size"),
    L("Testing a11y",["axe & Lighthouse audits.","Manual checklist.","WCAG conformance levels."],"axe-core · Lighthouse a11y · screen readers (NVDA/VoiceOver) · keyboard-only testing · WCAG A/AA/AAA · POUR principles · manual checklist",["Run an axe scan and fix one issue."]),
  ]},
  {t:"Web Performance",lessons:[
    L("Core Web Vitals",["LCP, INP, CLS.","Field vs lab data.","Targets & thresholds."],"LCP (largest contentful paint) · INP (interaction to next paint) · CLS (cumulative layout shift) · TTFB · FCP · field vs lab data · thresholds · CrUX"),
    L("Measuring",["Lighthouse & DevTools.","WebPageTest.","Performance API."],"Lighthouse · DevTools Performance panel · flame charts · WebPageTest · Performance API · Navigation/Resource Timing · web-vitals library · RUM",["Run Lighthouse and read the report."]),
    L("Loading Optimization",["Lazy loading & code splitting.","Image formats & srcset.","Critical CSS & preload."],"lazy loading · code splitting · dynamic import · image formats (webp/avif) · srcset/sizes · responsive images · critical CSS · preload/prefetch · font loading · compression"),
    L("Runtime Performance",["Avoid layout thrash.","Debounce/throttle.","Find memory leaks."],"layout thrashing · reflow/repaint · requestAnimationFrame · debounce · throttle · virtualization · memory leaks · detached DOM nodes · profiling"),
  ]},
  {t:"Build Tooling",lessons:[
    L("Bundlers",["Webpack vs Vite vs esbuild.","Dev server & HMR.","Tree-shaking & code splitting."],"module bundling · Webpack config/loaders/plugins · Vite · esbuild/Rollup · dev server · hot module replacement · tree-shaking · code splitting · entry/output"),
    L("Optimization",["Source maps & minification.","Asset hashing & caching.","Bundle analysis."],"source maps · minification · uglify/terser · asset hashing · cache busting · long-term caching · bundle analyzer · chunk splitting · gzip/brotli"),
  ]},
 ]},

{track:"angular",title:"Angular",phase:"PHASE 03",color:"#e0533d",
 desc:"Modern Angular (standalone + signals) end-to-end: components, RxJS, forms, routing, change detection, state.",
 modules:[
  {t:"Components & Templates",lessons:[
    L("Component Anatomy",["@Component selector/template/styles.","Standalone components (default).","ViewEncapsulation."],"@Component decorator · selector · template/templateUrl · styles · standalone: true · imports array · ViewEncapsulation (Emulated/None/ShadowDom) · component tree · CLI ng generate",["Generate and render your first standalone component."]),
    L("Data Binding",["Interpolation, property, event, two-way.","Template reference variables.","Safe navigation operator."],"interpolation {{}} · property binding [prop] · attribute binding · class/style binding · event binding (event) · two-way [(ngModel)] · template reference #var · safe navigation ?.",["Bind an input to a live preview."]),
    L("Inputs, Outputs & Signals",["input()/output() signal APIs.","Required & transformed inputs.","Parent↔child communication."],"@Input/@Output (legacy) · input() signal · output() · required inputs · input transforms · EventEmitter · two-way model() · parent-child communication · ViewChild/ContentChild",["Pass data down and emit an event up."]),
    L("Control Flow",["@if / @for / @switch.","@for track for performance.","@defer lazy blocks."],"@if/@else · @for & track · @empty · @switch/@case · *ngIf/*ngFor (legacy) · @defer · loading/placeholder/error blocks · trackBy"),
    code("typescript",`@Component({
  selector:'app-counter', standalone:true,
  template:\`<button (click)="dec()">-</button>{{count()}}<button (click)="inc()">+</button>\`
})
export class Counter {
  count = signal(0);
  inc(){ this.count.update(v=>v+1); }
  dec(){ this.count.update(v=>v-1); }
}`)
  ]},
  {t:"Directives, Pipes, DI",lessons:[
    L("Directives & Pipes",["Attribute & structural directives.","Custom directive via HostBinding.","Pure vs impure pipes; custom pipes."],"built-in directives · ngClass/ngStyle · attribute vs structural directives · custom @Directive · HostBinding/HostListener · built-in pipes (date/currency/async) · pure vs impure · custom @Pipe transform",["Write a directive that highlights on hover."]),
    L("Services & DI",["@Injectable, providedIn:'root'.","Hierarchical injectors; inject().","useClass/useValue/useFactory tokens."],"@Injectable · providedIn:'root' · constructor injection · inject() function · hierarchical injectors · InjectionToken · useClass/useValue/useFactory/useExisting · multi providers · optional/self/skipSelf",["Move data logic into a service and inject it."]),
  ]},
  {t:"RxJS & Reactivity",lessons:[
    L("Observables",["Streams over time; subscribe.","Subject/BehaviorSubject/ReplaySubject.","Cold vs hot."],"Observable · subscribe/unsubscribe · Observer · of/from/interval · Subject · BehaviorSubject · ReplaySubject · AsyncSubject · cold vs hot observables · multicasting"),
    L("Operators",["map/filter/tap; switchMap vs mergeMap vs concatMap.","debounceTime, distinctUntilChanged.","combineLatest, forkJoin, catchError."],"pipe() · map/filter/tap/scan · switchMap/mergeMap/concatMap/exhaustMap · debounceTime · distinctUntilChanged · take/takeUntil · combineLatest/forkJoin/merge/zip · catchError/retry · startWith",["Build a debounced search-as-you-type."]),
    L("Subscription & Signals",["Leaks; async pipe; takeUntilDestroyed.","Signals: computed, effect.","toSignal/toObservable bridge."],"memory leaks · manual unsubscribe · async pipe · takeUntilDestroyed · DestroyRef · signal() · computed() · effect() · set/update · toSignal/toObservable · signal inputs"),
  ]},
  {t:"HTTP, Routing, Forms",lessons:[
    L("HttpClient & Interceptors",["Typed GET/POST; catchError/retry.","Functional interceptors for auth/logging.","Loading & error UX."],"provideHttpClient · get/post/put/delete · typed responses · HttpParams/HttpHeaders · observe response · functional interceptors · auth token injection · error handling · retry · loading state",["Call a REST API and show a loading spinner."]),
    L("Routing & Guards",["Routes, params, child routes.","CanActivate guards; lazy loadComponent.","Resolvers & preloading."],"RouterModule/provideRouter · routerLink · router-outlet · route params · query params · child/nested routes · functional guards (CanActivate/CanDeactivate) · loadComponent/loadChildren · resolvers · preloading strategies",["Add a protected route behind a guard."]),
    L("Reactive Forms",["FormGroup/FormControl/FormArray.","Validators (sync/async/custom).","Typed forms."],"FormControl · FormGroup · FormArray · FormBuilder · validators (required/min/pattern) · custom validators · async validators · valueChanges/statusChanges · typed forms · form state (dirty/touched/valid)",["Build a signup form with validation."]),
  ]},
  {t:"Performance & State",lessons:[
    L("Change Detection",["Zone.js; Default vs OnPush.","markForCheck; signals & CD.","Zoneless mode."],"Zone.js · change detection cycle · Default strategy · OnPush · ChangeDetectorRef · markForCheck/detectChanges/detach · immutability · signals & CD · zoneless mode"),
    L("State Management",["Service + signals for local state.","NgRx store/actions/effects/selectors.","@ngrx/signals SignalStore."],"service-based state · signals state · NgRx store · actions · reducers · effects · selectors · entity adapter · @ngrx/signals SignalStore · component store · when to use global state"),
    L("Testing & Build",["TestBed, HttpTestingController.","Production build, AOT, budgets.","SSR/hydration; deploy static."],"TestBed · component testing · HttpTestingController · spies/mocks · ng build · AOT compilation · bundle budgets · lazy chunks · SSR (Angular Universal) · hydration · static deploy",["Write a unit test for a component."]),
  ]},
  {t:"Advanced Angular",lessons:[
    L("Animations",["@angular/animations triggers.","State transitions & keyframes.","Route animations."],"trigger/state/transition/animate · style() · keyframes() · enter/leave (:enter/:leave) · query/stagger · route transition animations · disabling animations"),
    L("Internationalization (i18n)",["$localize & message extraction.","Locale data: dates, numbers.","Build-time vs runtime i18n."],"i18n attribute · $localize · message extraction · ICU expressions (plural/select) · locale registration · LOCALE_ID · date/number/currency pipes per locale · build-time vs runtime"),
    L("Angular CDK",["Overlay, Portal, A11y.","Drag & drop.","Virtual scrolling."],"CDK overlay · portal · a11y (FocusTrap/LiveAnnouncer) · drag-drop (cdkDrag/cdkDropList) · virtual scrolling (cdk-virtual-scroll-viewport) · layout (BreakpointObserver) · clipboard",["Add virtual scroll to a long list."]),
    L("Angular Material",["Component library setup.","Theming & typography.","Form-field integration."],"install & setup · material components · mat-form-field · theming (palettes) · typography config · density · dark mode · custom themes · accessibility"),
    L("Schematics & Builders",["Custom generators.","Builders & CLI extension.","Workspace config."],"schematics concept · ng generate · custom schematics · Tree/Rule · builders · angular.json · workspace config · libraries (ng-packagr)"),
    L("Monorepo & Micro-frontends",["Nx workspace & libraries.","Module Federation.","Shared state across apps."],"Nx workspace · apps & libs · project boundaries · affected commands · Module Federation · webpack/native federation · shell & remotes · shared dependencies · cross-app state"),
  ]},
 ]},

{track:"java",title:"Java",phase:"PHASE 04",color:"#e2a23b",
 desc:"From JVM internals to modern Java 21 — the language, runtime, memory model, and standard library in depth.",
 modules:[
  {t:"Platform & Execution",lessons:[
    L("JDK / JRE / JVM",["JVM runs bytecode; HotSpot impl.","JRE = JVM + libs; JDK = JRE + tools.","Bytecode & platform independence."],"JVM vs JRE vs JDK · HotSpot · bytecode · javac · javap · platform independence · java command · JAVA_HOME · JVM languages · LTS versions"),
    L("Class Loading & JIT",["Load→Link→Init; classloader delegation.","Interpreter + C1/C2 tiered JIT.","Inlining, escape analysis."],"loading/linking/initialization · classloader hierarchy · delegation model · custom classloaders · interpreter · JIT C1/C2 · tiered compilation · inlining · escape analysis · OSR"),
    L("Memory & GC",["Heap/Stack/Metaspace.","Generational GC; GC roots.","G1/ZGC; -Xms -Xmx tuning."],"heap · stack · metaspace · PC register · young/old generation · Eden/Survivor · GC roots · reachability · mark-sweep-compact · G1/ZGC/Shenandoah · -Xms/-Xmx · GC logs",["Print and read a basic GC log."]),
  ]},
  {t:"Types & OOP",lessons:[
    L("Primitives, Wrappers, Strings",["8 primitives; autoboxing; Integer cache.","String pool; StringBuilder; text blocks.","var, final, immutability."],"8 primitives · default values · wrapper classes · autoboxing/unboxing · Integer cache -128..127 · String immutability · string pool · intern() · StringBuilder/StringBuffer · text blocks · var · final"),
    L("OOP Pillars",["Encapsulation, inheritance, polymorphism, abstraction.","Overriding vs overloading.","Constructor chaining this()/super()."],"encapsulation · access modifiers · inheritance · extends · super · method overriding · @Override · overloading · polymorphism (runtime/compile) · abstraction · constructor chaining · static vs instance",["Model a shape hierarchy with polymorphism."]),
    L("Interfaces & Abstract",["Abstract class vs interface.","default & static interface methods.","Multiple interface inheritance."],"abstract class · abstract methods · interface · default methods · static interface methods · private interface methods · multiple inheritance · diamond problem · functional interfaces · marker interfaces"),
    L("equals / hashCode / Records",["equals–hashCode contract.","Objects.equals/hash.","record & sealed classes + pattern switch."],"equals contract · hashCode contract · Objects.equals/hash · identity vs equality · immutability · record · compact constructors · sealed classes · permits · pattern matching switch"),
    code("java",`record Point(int x,int y){}
sealed interface Shape permits Circle,Square{}
record Circle(double r) implements Shape{}
record Square(double s) implements Shape{}
double area(Shape sh){ return switch(sh){
  case Circle c -> Math.PI*c.r()*c.r();
  case Square s -> s.s()*s.s();
};}`)
  ]},
  {t:"Generics & Collections",lessons:[
    L("Generics",["Generic types & methods; bounds.","Wildcards & PECS.","Type erasure limits."],"generic classes · generic methods · type parameters · bounded types (extends) · multiple bounds · wildcards ? · upper/lower bounds · PECS · type erasure · bridge methods · reifiable types"),
    L("Collections",["List/Set/Map implementations & Big-O.","HashMap internals: buckets, treeify, resize.","Fail-fast iterators; concurrent collections."],"List/Set/Map/Queue · ArrayList vs LinkedList · HashSet/TreeSet/LinkedHashSet · HashMap/TreeMap/LinkedHashMap · HashMap buckets/treeify/load factor · Comparable/Comparator · fail-fast · ConcurrentHashMap · CopyOnWriteArrayList",["Pick the right collection for a frequency count."]),
  ]},
  {t:"Functional & Concurrency",lessons:[
    L("Lambdas & Streams",["Functional interfaces; method refs.","Stream pipeline: map/filter/reduce/collect.","Collectors.groupingBy; Optional."],"lambda syntax · @FunctionalInterface · Function/Predicate/Consumer/Supplier · method references · stream source/intermediate/terminal · map/filter/reduce · collect · Collectors (groupingBy/joining/toMap) · flatMap · Optional · parallel streams",["Group a list of objects by a field with streams."]),
    L("Exceptions",["Checked vs unchecked hierarchy.","try-with-resources.","Best practices."],"Throwable/Error/Exception · checked vs unchecked · RuntimeException · try/catch/finally · multi-catch · try-with-resources · AutoCloseable · suppressed exceptions · custom exceptions · best practices"),
    L("Concurrency",["Threads, synchronized, volatile, JMM.","ExecutorService, locks, atomics.","CompletableFuture; virtual threads (21)."],"Thread/Runnable/Callable · thread lifecycle · synchronized · volatile · Java Memory Model · happens-before · ExecutorService · thread pools · ReentrantLock/ReadWriteLock · atomics · CountDownLatch/Semaphore · BlockingQueue · CompletableFuture · virtual threads",["Run tasks in parallel with an executor pool."]),
  ]},
  {t:"Standard Library Depth",lessons:[
    L("Date & Time API",["LocalDate/LocalDateTime/Instant.","ZonedDateTime & time zones.","Duration/Period & formatting."],"LocalDate/LocalTime/LocalDateTime · Instant · ZonedDateTime · ZoneId/ZoneOffset · Duration vs Period · DateTimeFormatter · parsing · legacy Date/Calendar · temporal adjusters"),
    L("Regex & Text",["Pattern & Matcher.","Groups & lookahead.","Common pitfalls."],"Pattern.compile · Matcher · find/matches/group · character classes · quantifiers · anchors · capturing/named groups · lookahead/lookbehind · backreferences · greedy vs lazy · flags"),
    L("I/O & NIO",["Streams, readers, writers.","Path & Files; channels/buffers.","try-with-resources."],"InputStream/OutputStream · Reader/Writer · BufferedReader · Path/Paths · Files API · Files.lines/readAllLines · channels · buffers · NIO vs IO · charset · try-with-resources"),
    L("Serialization",["Serializable & transient.","JSON via Jackson.","Versioning & security risks."],"Serializable · serialVersionUID · transient · ObjectOutputStream · externalizable · Jackson ObjectMapper · @JsonProperty · custom serializers · versioning · deserialization security"),
    L("JDBC",["Connection, Statement, ResultSet.","PreparedStatement vs injection.","Connection pooling."],"DriverManager/DataSource · Connection · Statement vs PreparedStatement · SQL injection · ResultSet · batch updates · transactions · connection pooling (HikariCP) · try-with-resources"),
  ]},
  {t:"Advanced Language & Tuning",lessons:[
    L("Annotations & Reflection",["Custom annotations & retention.","Reflection API powers frameworks.","Performance/security trade-offs."],"built-in annotations · @Retention/@Target · custom annotations · annotation processing · Class object · getMethods/getFields · setAccessible · invoke · dynamic proxies · performance cost"),
    L("Java Modules (JPMS)",["module-info; exports/requires.","Strong encapsulation.","Migration concerns."],"module-info.java · requires · exports · opens · provides/uses · strong encapsulation · automatic modules · unnamed module · jlink · migration"),
    L("Benchmarking (JMH)",["Microbenchmark pitfalls.","Warmup & JIT effects.","Profiling tips."],"JMH setup · @Benchmark · warmup iterations · dead code elimination · Blackhole · @State · fork/iterations · JIT effects · profilers (async-profiler/JFR)"),
  ]},
 ]},

{track:"spring",title:"Spring Boot",phase:"PHASE 05",color:"#7bc043",
 desc:"Spring core through production REST services: IoC, web, validation, security, AOP, testing, microservices.",
 modules:[
  {t:"Core & Boot",lessons:[
    L("IoC & DI",["Container wires beans; constructor injection.","@Component/@Service/@Repository.","Scopes & lifecycle hooks."],"IoC container · ApplicationContext · BeanFactory · constructor/setter/field injection · @Autowired · @Component/@Service/@Repository/@Controller · @Qualifier/@Primary · bean scopes · @PostConstruct/@PreDestroy",["Inject one service into another via constructor."]),
    L("Auto-configuration",["@SpringBootApplication breakdown.","Starters & managed versions.","Conditional beans."],"@SpringBootApplication · @EnableAutoConfiguration · @ComponentScan · @Configuration/@Bean · starters · BOM/parent · @Conditional · spring.factories/AutoConfiguration.imports · embedded server"),
    L("Config & Profiles",["application.yml; @ConfigurationProperties.","Profiles dev/test/prod.","Property precedence."],"application.properties/yml · @Value · @ConfigurationProperties · relaxed binding · profiles · @Profile · spring.profiles.active · property precedence · environment variables · config import"),
  ]},
  {t:"Web & REST",lessons:[
    L("Controllers & Mapping",["@RestController; @GetMapping/@PostMapping.","@PathVariable/@RequestParam/@RequestBody.","ResponseEntity & status."],"@RestController · @RequestMapping · @GetMapping/@PostMapping/@PutMapping/@DeleteMapping · @PathVariable · @RequestParam · @RequestBody · @ResponseBody · ResponseEntity · status codes · Jackson serialization",["Build CRUD endpoints for one resource."]),
    L("Validation & Errors",["Bean Validation @Valid.","@ControllerAdvice global handling.","ProblemDetail (RFC 7807)."],"Bean Validation · @Valid/@Validated · @NotNull/@Size/@Email · BindingResult · custom validators · @ExceptionHandler · @ControllerAdvice · @ResponseStatus · ProblemDetail · error DTOs",["Return a 400 with a clean error body on bad input."]),
    code("java",`@RestController @RequestMapping("/api/orders")
class OrderController {
  @PostMapping ResponseEntity<OrderDto> create(@Valid @RequestBody OrderReq r){
    return ResponseEntity.status(CREATED).body(service.create(r));
  }
}`)
  ]},
  {t:"Cross-cutting & Test",lessons:[
    L("Security",["Filter chain; SecurityFilterChain bean.","JWT stateless auth; OAuth2/OIDC.","@PreAuthorize; BCrypt; CORS/CSRF."],"security filter chain · SecurityFilterChain bean · AuthenticationManager · UserDetailsService · JWT auth · OAuth2/OIDC · resource server · @PreAuthorize/@PostAuthorize · BCryptPasswordEncoder · CORS · CSRF · method security",["Secure an endpoint and require a JWT."]),
    L("AOP, Cache, Async",["@Around aspects for logging/metrics.","@Cacheable with Caffeine/Redis.","@Async, @Scheduled."],"AOP concepts (aspect/advice/pointcut/joinpoint) · @Aspect · @Around/@Before/@After · @EnableCaching · @Cacheable/@CacheEvict/@CachePut · Caffeine/Redis · @EnableAsync · @Async · @Scheduled (cron/fixedRate) · TaskExecutor"),
    L("Testing",["JUnit5 + Mockito; @WebMvcTest/@DataJpaTest.","@SpringBootTest; MockMvc.","Testcontainers for real DBs."],"JUnit 5 · @Test/@BeforeEach · Mockito @Mock/@InjectMocks · @WebMvcTest · @DataJpaTest · @SpringBootTest · MockMvc · @MockBean · Testcontainers · assertions · slice tests",["Write a MockMvc test for a controller."]),
  ]},
  {t:"Production",lessons:[
    L("Actuator & Observability",["/health /metrics; Micrometer→Prometheus.","Tracing (OpenTelemetry).","Logging strategy."],"Actuator endpoints · /health · /metrics · /info · custom health indicators · Micrometer · Prometheus · Grafana · distributed tracing · OpenTelemetry · structured logging"),
    L("Messaging & Microservices",["Kafka/RabbitMQ events; idempotency.","Gateway, discovery, circuit breaker.","Saga/outbox consistency."],"Kafka vs RabbitMQ · producers/consumers · @KafkaListener · idempotency · API gateway · service discovery (Eureka) · circuit breaker (Resilience4j) · saga pattern · outbox pattern · eventual consistency"),
    L("Build & Deploy",["Layered Docker / buildpacks.","12-factor config; secrets.","Graceful shutdown, probes."],"executable JAR · layered Docker images · Cloud Native Buildpacks · 12-factor config · externalized secrets · graceful shutdown · readiness/liveness probes · health groups"),
  ]},
  {t:"Reactive & Specialized Spring",lessons:[
    L("Spring WebFlux",["Reactive streams: Mono/Flux.","Non-blocking I/O & backpressure.","When reactive actually helps."],"Reactive Streams · Mono/Flux · operators · backpressure · Netty · WebClient · functional endpoints · R2DBC · blocking vs non-blocking · when to use reactive"),
    L("WebSockets & STOMP",["Real-time messaging.","STOMP over WebSocket.","SimpMessagingTemplate."],"WebSocket config · handlers · STOMP protocol · message broker · @MessageMapping · @SendTo · SimpMessagingTemplate · SockJS fallback · subscriptions"),
    L("Spring Batch",["Jobs, steps, chunks.","Reader/processor/writer.","Restart & scaling."],"Job/Step · chunk-oriented processing · ItemReader/ItemProcessor/ItemWriter · JobRepository · JobLauncher · restart/skip/retry · partitioning · listeners"),
    L("Spring Cloud",["Config server & gateway.","Discovery (Eureka), load balancing.","Resilience4j circuit breaker."],"Spring Cloud Config · Config Server/Client · Spring Cloud Gateway · routes/filters · Eureka discovery · load balancing · Resilience4j (circuit breaker/retry/rate limiter) · distributed config refresh"),
    L("RSocket, Mail & Scheduling",["RSocket request models.","Email sending.","Advanced scheduling."],"RSocket · request-response/stream/channel · fire-and-forget · JavaMailSender · email templates · @Scheduled · cron expressions · TaskScheduler · ThreadPoolTaskScheduler"),
  ]},
 ]},

{track:"database",title:"Databases & Persistence",phase:"PHASE 06",color:"#b08be0",
 desc:"Relational modeling and SQL performance, ORM mapping with JPA/Hibernate, migrations, and NoSQL/caching.",
 modules:[
  {t:"Relational & SQL",lessons:[
    L("SQL Essentials",["SELECT/INSERT/UPDATE/DELETE.","JOINs: inner/left/right/full.","GROUP BY, HAVING, aggregates."],"SELECT · WHERE · INSERT/UPDATE/DELETE · ORDER BY · LIMIT/OFFSET · INNER/LEFT/RIGHT/FULL JOIN · GROUP BY · HAVING · aggregates (COUNT/SUM/AVG/MIN/MAX) · DISTINCT · subqueries · aliases",["Write a query joining two tables and grouping results."]),
    L("Schema Design & Normalization",["1NF/2NF/3NF; keys & relations.","Constraints: PK, FK, unique, not null.","Denormalization trade-offs."],"1NF/2NF/3NF · BCNF · primary keys · foreign keys · unique/not null/check · composite keys · surrogate vs natural keys · relationships (1:1/1:N/M:N) · junction tables · denormalization",["Design tables for users, orders, items."]),
    L("Indexes & Performance",["B-tree indexes; composite & covering.","EXPLAIN/EXPLAIN ANALYZE.","Avoiding full scans; selectivity."],"B-tree index · composite indexes · covering indexes · unique indexes · EXPLAIN/EXPLAIN ANALYZE · query plan · seq scan vs index scan · selectivity/cardinality · index column order · over-indexing cost",["Add an index and compare query plans."]),
    L("Transactions & ACID",["ACID properties.","Isolation levels & anomalies.","Locking, deadlocks."],"atomicity/consistency/isolation/durability · BEGIN/COMMIT/ROLLBACK · isolation levels (read uncommitted/committed/repeatable read/serializable) · dirty/non-repeatable/phantom reads · locking · deadlocks · savepoints"),
  ]},
  {t:"ORM & Migrations",lessons:[
    L("JPA / Hibernate Mapping",["@Entity, @Id, relationships.","Lazy vs eager; persistence context.","N+1 problem → fetch join/@EntityGraph."],"@Entity/@Table · @Id/@GeneratedValue · @Column · @OneToMany/@ManyToOne/@OneToOne/@ManyToMany · owning side/mappedBy · cascade · orphanRemoval · FetchType LAZY/EAGER · persistence context · N+1 · fetch join · @EntityGraph",["Map a one-to-many relationship."]),
    L("Repositories & Queries",["Spring Data derived queries.","@Query JPQL/native; projections.","Pagination & sorting."],"JpaRepository · derived query methods · @Query JPQL · native queries · @Param · @Modifying · projections (interface/DTO) · Pageable/Sort · Specification · query by example"),
    L("Migrations",["Flyway/Liquibase versioned schema.","Repeatable vs versioned migrations.","Rollback strategy."],"Flyway · versioned (V__) migrations · repeatable (R__) · Liquibase changelogs · baseline · migration ordering · rollback strategy · CI integration · schema history table",["Write a Flyway migration to add a column."]),
  ]},
  {t:"NoSQL & Caching",lessons:[
    L("MongoDB Basics",["Documents & collections.","CRUD & queries; indexes.","Embedding vs referencing."],"documents/collections · BSON · CRUD operations · query operators · projection · indexes · compound indexes · embedding vs referencing · aggregation pipeline · Spring Data MongoDB"),
    L("Redis & Caching",["Key-value, TTL, data types.","Cache-aside pattern; invalidation.","Rate limiting & sessions."],"key-value store · data types (string/hash/list/set/zset) · TTL/expiry · cache-aside · write-through/write-behind · invalidation · eviction policies · pub/sub · rate limiting · session store",["Cache a slow query result with a TTL."]),
    L("Choosing a Store",["Relational vs document vs key-value.","CAP theorem intuition.","Polyglot persistence."],"relational vs document vs key-value vs graph vs column · CAP theorem · consistency models · ACID vs BASE · polyglot persistence · access patterns · scaling characteristics"),
  ]},
  {t:"PostgreSQL Deep",lessons:[
    L("JSON & JSONB",["Store & query JSON/JSONB.","GIN indexing & operators.","JSON vs columns trade-off."],"json vs jsonb · -> and ->> operators · @> containment · jsonb_set · GIN indexes · path queries · indexing strategies · when to use vs normalized columns"),
    L("Full-Text Search",["tsvector / tsquery.","Ranking & highlighting.","FTS indexes."],"tsvector · tsquery · to_tsvector/to_tsquery · @@ operator · ts_rank · ts_headline · GIN index for FTS · dictionaries/stemming · trigram (pg_trgm)",["Add full-text search to a table."]),
    L("Advanced Types & Extensions",["Arrays, enums, ranges, UUID.","Generated columns.","pg_trgm, PostGIS, pgvector."],"array types · enum types · range types · UUID/gen_random_uuid · generated columns · hstore · extensions · pg_trgm · PostGIS · pgvector for embeddings"),
    L("MVCC & Maintenance",["MVCC concurrency model.","Isolation in Postgres.","VACUUM & bloat."],"MVCC · tuple versions · visibility · transaction isolation in PG · VACUUM/autovacuum · table bloat · dead tuples · ANALYZE · explain buffers · connection limits"),
  ]},
 ]},

{track:"api",title:"REST & GraphQL APIs",phase:"PHASE 07",color:"#e535ab",
 desc:"Designing great REST APIs, then GraphQL end-to-end — schema design, Spring for GraphQL resolvers, Apollo Angular, DataLoader, subscriptions, and security.",
 modules:[
  {t:"REST API Design",lessons:[
    L("Resource Modeling",["Nouns not verbs; proper methods.","Status codes & error shapes.","Idempotency & safety."],"resource-oriented URIs · nouns vs verbs · collection vs item · HTTP methods mapping · status codes · error response shape · idempotency · safe methods · nesting resources · sub-resources",["Design endpoints for a blog (posts, comments)."]),
    L("Versioning & Pagination",["URI vs header versioning.","Offset vs cursor pagination.","Filtering, sorting, partial responses."],"URI versioning · header/media-type versioning · offset pagination · cursor pagination · page metadata · filtering · sorting · field selection · partial responses · rate limit headers"),
    L("Docs & Contracts",["OpenAPI/Swagger spec.","Contract-first design.","Mock servers."],"OpenAPI spec · Swagger UI · springdoc · contract-first vs code-first · schemas/components · examples · mock servers · client generation · API linting"),
  ]},
  {t:"GraphQL Fundamentals",lessons:[
    L("GraphQL vs REST",["Single endpoint; client-specified shape.","No over/under-fetching.","Strongly typed schema; trade-offs."],"single endpoint · client-specified queries · over-fetching/under-fetching · strongly typed schema · introspection · trade-offs vs REST · when to choose GraphQL · caching challenges"),
    L("Schema & Type System",["Scalars, objects, enums, lists, non-null.","Interfaces & unions; input types.","Schema Definition Language (SDL)."],"SDL · scalar types (Int/Float/String/Boolean/ID) · object types · fields & arguments · enums · lists [] · non-null ! · interfaces · unions · input types · custom scalars · schema root types",["Write SDL for a User with posts."]),
    L("Queries",["Fields, arguments, nesting.","Variables, aliases, fragments.","Directives @include/@skip."],"query operation · fields · arguments · nested selection · variables · aliases · fragments · inline fragments · directives @include/@skip · operation names · default values",["Query only the fields you need from a public API."]),
    L("Mutations",["Mutation type; input objects.","Returning updated data.","Naming & payload conventions."],"mutation operation · input types · arguments · returning modified data · payload pattern · naming conventions · multiple mutations ordering · error handling in payloads",["Write a createUser mutation."]),
    L("Subscriptions",["Real-time over WebSocket.","Event sources; pub/sub.","When to use vs polling."],"subscription operation · WebSocket transport · graphql-ws protocol · event publishing · pub/sub · filtering events · subscriptions vs polling · scaling subscriptions"),
    code("graphql",`type User { id: ID!  name: String!  posts: [Post!]! }
type Post { id: ID!  title: String!  author: User! }

type Query { user(id: ID!): User  users: [User!]! }
type Mutation { createUser(input: NewUser!): User! }
input NewUser { name: String! }
type Subscription { postAdded: Post! }`)
  ]},
  {t:"GraphQL Backend — Spring for GraphQL",lessons:[
    L("Setup & Schema-first",["spring-boot-starter-graphql.","Place .graphqls schema; GraphiQL.","Map schema types to Java records/entities."],"starter-graphql dependency · schema.graphqls location · GraphiQL UI · /graphql endpoint · schema-first approach · mapping types to records/entities · RuntimeWiring",["Expose a /graphql endpoint with one query."]),
    L("Resolvers",["@QueryMapping & @MutationMapping.","@SchemaMapping for nested fields.","@Argument binding."],"@QueryMapping · @MutationMapping · @SchemaMapping · @Argument · @Argument binding to objects · DataFetchingEnvironment · controller-based resolvers · field resolution order",["Implement a query and a mutation resolver."]),
    L("N+1 & DataLoader",["Nested resolvers cause N+1.","@BatchMapping batches loads.","DataLoader registry & caching per request."],"N+1 problem · @BatchMapping · DataLoader · batch loading function · per-request caching · DataLoaderRegistry · mapped vs list batch · keys ordering",["Batch-load post authors to kill N+1."]),
    L("Errors, Validation, Subscriptions",["DataFetcherExceptionResolver.","Bean validation on inputs.","Subscriptions via WebSocket/RSocket."],"DataFetcherExceptionResolver · GraphQLError · error classification · bean validation on @Argument · @SubscriptionMapping · Flux returns · WebSocket/RSocket transport · error extensions"),
    code("java",`@Controller
class UserGraphql {
  @QueryMapping User user(@Argument String id){ return repo.find(id); }
  @MutationMapping User createUser(@Argument NewUser input){ return repo.save(input); }
  @BatchMapping List<List<Post>> posts(List<User> users){ return loader.byUsers(users); }
}`)
  ]},
  {t:"GraphQL Frontend — Apollo Angular",lessons:[
    L("Apollo Client Setup",["apollo-angular + HttpLink.","InMemoryCache; provideApollo.","GraphiQL/Sandbox exploration."],"apollo-angular install · provideApollo · HttpLink · InMemoryCache · GraphQL endpoint config · Apollo Sandbox · gql tag · client options",["Wire Apollo into an Angular app."]),
    L("Queries & Caching",["watchQuery → Observable.","Normalized cache; cache-first policy.","Loading/error states."],"query/watchQuery · Observable results · variables · normalized cache · cache keys (typename+id) · fetch policies (cache-first/network-only) · loading/error/data states · polling/refetch",["Render a list from a GraphQL query."]),
    L("Mutations & Cache Updates",["mutate(); update cache after write.","Optimistic UI.","refetchQueries."],"mutate() · variables · update function · cache.modify/writeQuery · optimisticResponse · refetchQueries · error handling · cache normalization after mutation",["Add an item and update the cache without refetch."]),
    L("Typed Codegen",["graphql-codegen typed operations.","Generated hooks/services.","End-to-end type safety."],"graphql-code-generator · schema introspection · typed operations · generated services/types · .graphql documents · config (codegen.yml) · end-to-end type safety"),
  ]},
  {t:"Advanced GraphQL",lessons:[
    L("Pagination",["Relay cursor connections.","edges/node/pageInfo.","Backend implementation."],"offset vs cursor pagination · Relay connection spec · edges/node · cursor encoding · pageInfo (hasNextPage/endCursor) · first/after args · backend implementation"),
    L("Federation & Composition",["Apollo Federation; subgraphs.","Schema stitching vs federation.","Gateway composition."],"Apollo Federation · subgraphs · @key/@external directives · entity resolution · supergraph composition · gateway · schema stitching · vs monolith schema"),
    L("Security & Performance",["Depth & complexity limiting.","Persisted queries; auth in resolvers.","Caching & APQ."],"query depth limiting · query complexity/cost analysis · rate limiting · persisted queries (APQ) · auth in resolvers · field-level authorization · introspection in prod · response caching",["Add a query depth limit to block abuse."]),
  ]},
  {t:"Beyond REST & GraphQL",lessons:[
    L("gRPC & Protobuf",["Protocol buffers schema.","Streaming RPC.","REST vs gRPC."],"protocol buffers · .proto schema · message/service definitions · code generation · unary/server/client/bidirectional streaming · HTTP/2 · gRPC vs REST · interceptors"),
    L("Webhooks",["Event delivery & retries.","Signature verification.","Idempotency."],"webhook concept · event payloads · delivery & retries · exponential backoff · signature verification (HMAC) · idempotency keys · ordering · dead-letter handling"),
    L("API Gateway & Rate Limiting",["Gateway responsibilities.","Throttling & quotas.","Auth at the edge."],"gateway responsibilities · routing · request aggregation · throttling · rate limiting algorithms (token/leaky bucket) · quotas · auth at edge · API keys · request transformation"),
    L("File Uploads & Streaming",["Multipart uploads.","Large files & streaming.","GraphQL file uploads."],"multipart/form-data · MultipartFile · streaming uploads · chunked/resumable uploads · presigned URLs · large file handling · GraphQL multipart spec · download streaming"),
    L("HTTP Caching & Codegen",["ETags & cache headers.","Redis response caching.","OpenAPI/GraphQL codegen."],"Cache-Control · ETag · If-None-Match · 304 responses · CDN caching · Redis response cache · cache keys · OpenAPI client codegen · GraphQL codegen"),
  ]},
  {t:"AI / LLM Integration",lessons:[
    L("Calling LLM APIs",["Chat, completion, embeddings endpoints.","Tokens, context windows, cost.","Streaming responses."],"chat/completion endpoints · embeddings endpoint · API keys · tokens · context window · temperature/top-p · max tokens · cost estimation · streaming (SSE) · rate limits",["Call an LLM API and stream the reply."]),
    L("Prompt Engineering",["System vs user prompts.","Structured JSON output.","Few-shot & guardrails."],"system vs user prompts · instructions · few-shot examples · structured/JSON output · output schemas · chain-of-thought · guardrails · prompt templates · context injection"),
    L("RAG & Vector Search",["Embeddings & similarity.","Vector DBs (pgvector, Pinecone).","Chunking & retrieval."],"embeddings · cosine similarity · vector databases · pgvector/Pinecone/Weaviate · document chunking · retrieval · top-k · re-ranking · context window stuffing · citations",["Build a tiny RAG over a few documents."]),
    L("Spring AI & Tooling",["Spring AI / LangChain4j.","Tool / function calling.","Caching & rate limits."],"Spring AI · ChatClient · LangChain4j · prompt templates · function/tool calling · structured output mapping · vector store integration · advisors · caching/rate limits"),
    L("Safety & Evaluation",["Hallucination mitigation.","PII & prompt injection.","Evaluating outputs."],"hallucinations · grounding/RAG · prompt injection · jailbreaks · PII handling · content moderation · evaluation metrics · golden datasets · human review · guardrail libraries"),
  ]},
 ]},

{track:"testing",title:"Testing & Quality",phase:"PHASE 08",color:"#f0a35e",
 desc:"Confidence through tests — unit, integration, end-to-end, performance, and the discipline of TDD across the stack.",
 modules:[
  {t:"Test Fundamentals",lessons:[
    L("Testing Pyramid & TDD",["Unit/integration/E2E balance.","Red-green-refactor.","Arrange-Act-Assert."],"testing pyramid · unit vs integration vs E2E ratio · TDD cycle (red-green-refactor) · arrange-act-assert · test naming · given-when-then · regression tests",["Write a failing test, then make it pass."]),
    L("Unit Testing",["JUnit5/Jest assertions.","Mocking & stubbing (Mockito).","Coverage & test doubles."],"JUnit 5/Jest · assertions · @Test/@BeforeEach · parameterized tests · mocks/stubs/spies/fakes · Mockito when/verify · argument matchers · code coverage · test doubles",["Unit test a function with edge cases."]),
    L("Test Design",["FIRST principles.","Parameterized tests.","Fixing flaky tests."],"FIRST principles · isolation · deterministic tests · test data builders · parameterized/data-driven tests · flaky test causes · test smells · DAMP vs DRY in tests"),
  ]},
  {t:"Integration & E2E",lessons:[
    L("Integration Testing",["Spring slice & full context.","Testcontainers.","DB & API integration."],"@SpringBootTest · slice tests · test profiles · Testcontainers · real DB in Docker · transactional rollback · @MockBean · WireMock · API integration tests"),
    L("E2E: Playwright / Cypress",["Browser automation.","Selectors & assertions.","CI integration."],"Playwright/Cypress setup · selectors (role/text/testid) · actions (click/fill) · assertions · waiting/auto-wait · fixtures · network mocking · screenshots/trace · CI integration",["Write an E2E test for a login flow."]),
    L("Contract & API Testing",["Consumer-driven contracts (Pact).","REST-assured / Postman.","Schema validation."],"consumer-driven contracts · Pact · provider/consumer · Spring Cloud Contract · REST-assured · Postman/Newman · schema validation · API mocking"),
  ]},
  {t:"Performance & Quality Gates",lessons:[
    L("Load & Stress Testing",["k6 / JMeter / Gatling.","Throughput, latency, percentiles.","Bottleneck analysis."],"load vs stress vs soak tests · k6/JMeter/Gatling · virtual users · throughput (RPS) · latency percentiles (p50/p95/p99) · ramp-up · thresholds · bottleneck analysis"),
    L("Quality Gates",["Coverage thresholds.","SonarQube / static analysis.","Mutation testing."],"coverage thresholds · branch vs line coverage · SonarQube · static analysis · code smells/security hotspots · mutation testing (PIT) · quality gates in CI · linting"),
  ]},
 ]},

{track:"security",title:"Security",phase:"PHASE 09",color:"#d64550",
 desc:"Build apps that don't get owned — OWASP Top 10, common attacks, secure auth, and supply-chain hygiene.",
 modules:[
  {t:"Web Vulnerabilities (OWASP)",lessons:[
    L("OWASP Top 10",["The top risks overview.","Real-world examples.","Mitigation mindset."],"broken access control · cryptographic failures · injection · insecure design · security misconfiguration · vulnerable components · auth failures · integrity failures · logging failures · SSRF",["Spot one OWASP risk in a sample app."]),
    L("Injection & SQLi",["SQL injection mechanics.","Parameterized queries.","Command/LDAP injection."],"SQL injection mechanics · UNION/blind/error-based · parameterized queries/prepared statements · ORM safety · input validation · command injection · LDAP/NoSQL injection · least privilege DB user"),
    L("Cross-Site Scripting (XSS)",["Stored/reflected/DOM XSS.","Output encoding & CSP.","Sanitization."],"reflected XSS · stored XSS · DOM-based XSS · output encoding · context-aware escaping · Content-Security-Policy · sanitization (DOMPurify) · HttpOnly cookies · framework auto-escaping"),
    L("CSRF & SSRF",["CSRF tokens & SameSite cookies.","SSRF risks.","Defenses."],"CSRF mechanics · anti-CSRF tokens · SameSite cookies · double-submit · SSRF mechanics · metadata endpoint abuse · allowlists · URL validation · network segmentation"),
  ]},
  {t:"Auth & Data Protection",lessons:[
    L("Authentication & Sessions",["Password hashing (bcrypt/argon2).","Session vs token; JWT pitfalls.","MFA."],"password hashing (bcrypt/argon2/scrypt) · salting · session cookies · session fixation · JWT structure · JWT pitfalls (alg none/expiry) · refresh tokens · MFA/TOTP · account lockout"),
    L("Authorization",["RBAC / ABAC.","Broken access control.","Least privilege."],"authentication vs authorization · RBAC · ABAC · roles & permissions · broken access control · IDOR · privilege escalation · least privilege · deny by default"),
    L("Transport & Crypto",["TLS/HTTPS & HSTS.","Hashing vs encryption.","Key management."],"TLS handshake · certificates · HTTPS · HSTS · hashing vs encryption · symmetric vs asymmetric · AES/RSA · key management · secrets at rest · perfect forward secrecy"),
  ]},
  {t:"Supply Chain & Ops",lessons:[
    L("Dependency Security",["CVE scanning (Dependabot/Snyk).","Lockfile integrity.","SBOM."],"CVE/CVSS · Dependabot · Snyk/OWASP dependency-check · lockfile integrity · transitive dependencies · SBOM · supply-chain attacks · pinning versions"),
    L("Secrets & Config Hygiene",["No secrets in code.","Env vars & vaults.","Rotation & audit."],"no secrets in code · .env & gitignore · secret scanning · environment variables · vaults (HashiCorp/cloud) · rotation · audit logging · principle of least exposure"),
  ]},
 ]},

{track:"devops",title:"DevOps & Deployment",phase:"PHASE 10",color:"#4fa3e0",
 desc:"Containerize, automate, and ship — Docker, CI/CD pipelines, cloud deployment, config, and monitoring.",
 modules:[
  {t:"Containers",lessons:[
    L("Docker Basics",["Images vs containers; layers.","Dockerfile: FROM/COPY/RUN/CMD.","Volumes, ports, networks."],"images vs containers · layers & caching · Dockerfile (FROM/COPY/RUN/CMD/ENTRYPOINT) · build/run/exec · ports -p · volumes · environment vars · .dockerignore · multi-stage builds",["Containerize a Spring Boot app.","Containerize an Angular build behind Nginx."]),
    L("Docker Compose",["Multi-service definitions.","Networks & depends_on.","Env files & overrides."],"compose.yml · services · networks · volumes · depends_on · environment/env_file · ports mapping · build vs image · override files · compose up/down",["Compose app + Postgres + Redis together."]),
    L("Registries",["Build, tag, push images.","Docker Hub / GHCR.","Image size & multi-stage builds."],"build & tag · docker push/pull · Docker Hub · GHCR · image naming/tags · layer optimization · multi-stage builds · distroless/alpine · vulnerability scanning"),
  ]},
  {t:"CI/CD",lessons:[
    L("GitHub Actions",["Workflows, jobs, steps, triggers.","Run tests on PR.","Build & push artifacts."],"workflow YAML · triggers (push/pull_request) · jobs · steps · actions · runners · matrix builds · caching · secrets · artifacts · environment protection",["Add a CI workflow that runs tests on every push."]),
    L("Pipelines & Quality",["Lint, test, build, deploy stages.","Caching dependencies.","Secrets in CI."],"pipeline stages · lint/test/build/deploy · dependency caching · parallel jobs · conditional steps · secrets management · approvals/gates · deployment environments"),
  ]},
  {t:"Deploy & Operate",lessons:[
    L("Deploying the Stack",["Deploy Spring API (Railway/Render/cloud).","Deploy Angular static (Netlify/Vercel/CDN).","Reverse proxy with Nginx."],"deploy backend (Railway/Render/Fly/cloud) · environment config · deploy SPA (Netlify/Vercel/CDN) · static hosting · SPA fallback routing · Nginx reverse proxy · HTTPS/Let's Encrypt",["Deploy your full app publicly."]),
    L("Config & Secrets",["Env vars; 12-factor.","Secret managers.","Per-environment config."],"12-factor config · environment variables · per-env config · secret managers · build vs runtime config · feature flags · config validation"),
    L("Monitoring & Logging",["Centralized logs.","Metrics & alerts.","Health checks & uptime."],"centralized logging · log aggregation · metrics · dashboards · alerting · uptime monitoring · health checks · on-call/incident basics · error tracking (Sentry)"),
  ]},
  {t:"Kubernetes & IaC",lessons:[
    L("Kubernetes Basics",["Pods, Deployments, Services.","ConfigMaps & Secrets.","Ingress & autoscaling."],"pods · ReplicaSets · Deployments · Services (ClusterIP/NodePort/LoadBalancer) · ConfigMaps · Secrets · Ingress · namespaces · kubectl · HPA autoscaling · liveness/readiness probes",["Deploy a container to a local k8s cluster."]),
    L("Helm & Manifests",["Helm charts & values.","Templating.","Releases & rollbacks."],"YAML manifests · Helm charts · Chart.yaml/values.yaml · templating · releases · upgrade/rollback · repositories · kustomize · chart dependencies"),
    L("Infrastructure as Code",["Terraform basics & state.","Providers & modules.","Plan/apply workflow."],"IaC concept · Terraform · HCL syntax · providers · resources · state file · remote state · modules · variables/outputs · plan/apply/destroy · drift"),
    L("Cloud Platforms",["AWS/GCP/Azure core services.","Compute, storage, managed DBs.","Cost & regions."],"compute (EC2/VM/Cloud Run) · object storage (S3/GCS) · managed databases (RDS) · networking/VPC · IAM · regions/AZs · managed k8s (EKS/GKE/AKS) · cost management"),
  ]},
  {t:"Observability & Networking",lessons:[
    L("Metrics & Dashboards",["Prometheus scraping.","Grafana dashboards & alerts.","SLI/SLO basics."],"metrics types (counter/gauge/histogram) · Prometheus scraping · PromQL · exporters · Grafana dashboards · alerting rules · SLI/SLO/SLA · error budgets"),
    L("Centralized Logging",["ELK / Loki stack.","Structured logs & correlation IDs.","Log levels."],"ELK (Elasticsearch/Logstash/Kibana) · Loki · log shipping · structured JSON logs · correlation/trace IDs · log levels · retention · search & filtering"),
    L("Distributed Tracing",["OpenTelemetry spans.","Context propagation.","Latency debugging."],"OpenTelemetry · spans/traces · context propagation · trace IDs · instrumentation · exporters (Jaeger/Tempo/Zipkin) · latency breakdown · service maps"),
    L("Networking & Delivery",["Load-balancing strategies.","Nginx reverse proxy deep.","CDN & TLS termination."],"load balancing (round-robin/least-conn) · L4 vs L7 · Nginx config · reverse proxy · upstream · CDN · edge caching · TLS termination · sticky sessions · health checks"),
    L("Logging Standards",["Structured logs (JSON).","Correlation/trace IDs.","Levels, sampling, retention."],"structured JSON logging · log schema · correlation/trace IDs · MDC context · log levels (trace/debug/info/warn/error) · sampling · PII redaction · retention policies"),
    L("Secrets Management",["Vault / secret stores.","Rotation.","Least privilege."],"secret stores (Vault/cloud) · dynamic secrets · rotation · least privilege access · encryption at rest · audit · injecting secrets into pods · sealed secrets"),
  ]},
 ]},

{track:"systemdesign",title:"System Design & Architecture",phase:"PHASE 11",color:"#8e9cf0",
 desc:"Think beyond one service — scalability, data, and architecture patterns to design systems that hold up.",
 modules:[
  {t:"Scalability Building Blocks",lessons:[
    L("Scaling Basics",["Vertical vs horizontal.","Stateless services.","Load balancing."],"vertical vs horizontal scaling · stateless services · session externalization · load balancers · health checks · auto-scaling · capacity estimation · single point of failure"),
    L("Caching Strategies",["Cache-aside, write-through.","CDN & edge caching.","Invalidation."],"cache-aside · read-through · write-through/write-behind · CDN · edge caching · TTL · eviction (LRU/LFU) · cache invalidation · cache stampede · hot keys"),
    L("Databases at Scale",["Replication & sharding.","CAP & consistency models.","SQL vs NoSQL choice."],"read replicas · primary-replica replication · sharding · partition keys · CAP theorem · consistency (strong/eventual) · denormalization · indexing at scale · SQL vs NoSQL at scale"),
    L("Messaging & Queues",["Async decoupling.","Kafka/RabbitMQ patterns.","Backpressure & DLQ."],"async decoupling · message queues vs streams · Kafka topics/partitions · consumer groups · RabbitMQ exchanges · at-least/exactly-once · backpressure · dead-letter queues · ordering"),
  ]},
  {t:"Architecture Patterns",lessons:[
    L("Clean & Hexagonal",["Ports & adapters.","Dependency rule.","Testability."],"layered architecture · hexagonal (ports & adapters) · clean architecture · dependency rule · domain isolation · use cases · adapters · testability · onion architecture"),
    L("Domain-Driven Design",["Bounded contexts.","Entities, aggregates, value objects.","Ubiquitous language."],"ubiquitous language · bounded contexts · context mapping · entities · value objects · aggregates & roots · domain events · repositories · domain services · anti-corruption layer"),
    L("Event-Driven & CQRS",["Event sourcing.","CQRS read/write split.","Eventual consistency."],"event-driven architecture · event sourcing · event store · CQRS · read/write models · projections · eventual consistency · sagas · idempotent consumers"),
    L("Microservice Patterns",["Saga, outbox, API composition.","Service boundaries.","Observability needs."],"service boundaries · database per service · API composition · saga (orchestration/choreography) · outbox pattern · strangler fig · circuit breaker · service mesh · distributed tracing"),
  ]},
  {t:"Designing Real Systems",lessons:[
    L("System Design Method",["Requirements → estimates → design.","Trade-off reasoning.","Bottleneck identification."],"functional/non-functional requirements · back-of-envelope estimates · QPS/storage math · high-level design · component diagram · data model · API design · trade-offs · bottlenecks",["Design a URL shortener end-to-end.","Design a news feed."]),
    L("Reliability",["Redundancy & failover.","Rate limiting & circuit breakers.","Graceful degradation."],"redundancy · failover · replication · rate limiting · circuit breakers · bulkheads · timeouts & retries · graceful degradation · idempotency · disaster recovery · RTO/RPO"),
  ]},
 ]},

{track:"career",title:"Career & Craft",phase:"PHASE 12",color:"#c98be0",
 desc:"The skills around the code — debugging, reading source, collaboration, and getting hired.",
 modules:[
  {t:"Engineering Craft",lessons:[
    L("Debugging Methodology",["Reproduce → isolate → fix.","Reading stack traces.","Binary search & git bisect."],"reproduce reliably · isolate variables · hypothesis-driven debugging · reading stack traces · logging strategically · debugger use · git bisect · binary search · rubber-duck debugging",["Debug a bug by forming a hypothesis first."]),
    L("Reading Docs & Source",["Navigating large codebases.","Reading official docs well.","Learning from source."],"navigating codebases · entry points · grep/IDE search · reading official docs · API references vs guides · reading library source · changelogs · RFCs"),
    L("Code Review",["Giving/receiving feedback.","Review checklists.","Small PRs."],"giving constructive feedback · receiving feedback · review checklist · small focused PRs · PR descriptions · nitpicks vs blockers · approving · pair review"),
    L("Advanced Git",["Interactive rebase & cherry-pick.","Bisect & reflog.","Recovering mistakes."],"interactive rebase · squash/fixup · cherry-pick · git bisect · reflog · recovering lost commits · resolving conflicts · stash · worktrees · hooks"),
    L("Technical Writing & Docs",["READMEs, ADRs, runbooks.","Clear API docs & comments.","Writing for your future self."],"README structure · architecture decision records (ADR) · runbooks · API docs · meaningful comments · diagrams · writing clearly · documentation as code"),
  ]},
  {t:"Getting Hired",lessons:[
    L("DSA Interview Prep",["Patterns: two pointers, sliding window, BFS/DFS.","Time/space analysis.","Practice cadence."],"arrays/strings/hashmaps · two pointers · sliding window · binary search · stacks/queues · trees/BFS/DFS · graphs · recursion/backtracking · dynamic programming · complexity analysis · practice cadence",["Solve one array and one string problem.","Explain your solution aloud."]),
    L("System Design Interview",["Framework & clarifying questions.","Whiteboarding trade-offs.","Common prompts."],"clarifying requirements · estimation · API/data model · high-level diagram · deep dives · trade-off discussion · bottlenecks/scaling · common prompts (URL shortener/chat/feed/rate limiter)"),
    L("Behavioral & Portfolio",["STAR stories.","Resume & GitHub presence.","Communication."],"STAR method · prepared stories · resume bullets (impact/metrics) · GitHub/portfolio · project READMEs · communication · negotiation basics · mock interviews"),
  ]},
 ]},

{track:"projects",title:"Capstone Projects",phase:"PHASE 13",color:"#cfc2a0",
 desc:"Practice everything together. Build these full-stack apps in order — each adds a layer until you've shipped production-grade software.",
 modules:[
  {t:"Build These In Order",lessons:[
    L("1 · Todo Full-Stack",["Angular UI + Spring REST + Postgres.","CRUD, validation, error handling.","Reactive forms + HttpClient."],"Angular components & routing · reactive forms · HttpClient service · Spring REST controller · JPA entity & repository · Postgres · validation · error handling · CORS",["Stretch: add filtering & sorting.","Stretch: persist to a real DB with JPA."]),
    L("2 · Blog with Auth",["JWT login/register; roles (user/admin).","Protected routes & guards.","CRUD posts + comments."],"register/login endpoints · password hashing · JWT issue/verify · Spring Security config · Angular auth interceptor · route guards · roles (user/admin) · posts & comments CRUD · ownership checks",["Stretch: refresh tokens.","Stretch: role-based UI."]),
    L("3 · GraphQL Real-Time Chat",["Spring for GraphQL + subscriptions.","Apollo Angular live updates.","DataLoader for users."],"GraphQL schema · queries/mutations · subscriptions over WebSocket · Spring for GraphQL resolvers · DataLoader · Apollo Angular · cache updates · live message stream",["Stretch: typing indicators.","Stretch: message pagination (cursor)."]),
    L("4 · E-Commerce API",["GraphQL + REST mix; cart & checkout.","Mock payments; order state machine.","Caching with Redis."],"product catalog · cart logic · checkout flow · order state machine · mock payment integration · Redis caching · inventory · GraphQL + REST mix · pagination",["Stretch: inventory concurrency handling.","Stretch: admin dashboard."]),
    L("5 · Analytics Dashboard",["Charts, filters, aggregated queries.","Caching & performance tuning.","OnPush + signals."],"aggregated SQL queries · charts (chart.js/d3) · filters & date ranges · OnPush + signals · caching · pagination · CSV export · performance tuning",["Stretch: export to CSV.","Stretch: scheduled report jobs."]),
    L("6 · Ship It",["Dockerize all services + Compose.","CI/CD with GitHub Actions.","Deploy publicly with monitoring."],"Dockerfiles · docker-compose · GitHub Actions CI/CD · automated tests in pipeline · deploy backend & frontend · environment config/secrets · monitoring & logging · health checks",["Stretch: add health checks & alerts.","Stretch: blue-green deploy."]),
  ]},
 ]},
];
