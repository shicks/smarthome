ts_srcs := $(wildcard src/*/*.ts)
proto_srcs := $(wildcard src/*/*.proto)

build_ts_srcs := $(patsubst src/%, build/%, $(ts_srcs))
build_js_raw_srcs := $(patsubst %.ts, %.raw.js, $(build_ts_srcs))
build_js_srcs := $(patsubst %.raw.js, %.js, $(build_js_raw_srcs))
pbjs_srcs := $(patsubst src/%.proto, build/%.pb.js, $(proto_srcs))
pbdts_srcs := $(patsubst %.js, %.d.ts, $(pbjs_srcs))
srcmaps := $(patsubst %.ts, %.js.map, $(build_ts_srcs))

test_srcs := $(wildcard test/*.ts)

out := $(patsubst build/%, out/%, $(build_js_srcs) $(pbjs_srcs))

mocha := node_modules/.bin/mocha
tsc := node_modules/.bin/tsc

# TODO - generate .deps files for src/**/*.ts and test/**/*.ts
#      - (just grep for import...? special handling for pb?)

# TODO - skip the wildcards, just straight-up generate the deps?

# -include $(srcs:src/%=build/%.deps) $(tests:test/%=build-test/%.deps)
# environment vars for $(TSC), etc


build/%.ts : src/%.ts
	mkdir -p "$$(dirname $@)"
	cp $< $@

build/%.pb.js : src/%.proto
	pbjs -t json-module -w commonjs $< \
	 	| sed s+protobufjs/minimal+protobufjs/light+ \
		> $@

build/%.pb.d.ts : src/%.proto
	pbjs -t static-module $< | pbts -o $@ -

# TODO - just ignore the map files - they always go together w/ the raw files
# build/fe/index.js build/fe/index.js.map : build/fe/config.pb.d.ts build/fe/config.pb.js build/fe/index.ts

$(build_js_srcs) : build/%.js : build/%.ts
	$(tsc) --config tsconfig.json $< || ( rm $@; false )

build/test.mk: $(test_srcs) Makefile
	mkdir -p "$$(dirname $@)"
	(tests=''; for a in $(test_srcs); do \
		test="$${a%.ts}"; \
	        tests="$$tests $$test"; \
	        printf "$$test : $$a\n\t\$$(mocha) -r ts-node/register $$a\n"; \
	done; echo "test :$$tests") > $@

-include build/test.mk
