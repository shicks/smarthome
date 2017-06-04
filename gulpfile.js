const gulp = require('gulp');
const sourcemaps = require('gulp-sourcemaps');
const ts = require('gulp-typescript');
const {spawn} = require('child_process');
const through = require('through2');
const Vinyl = require('vinyl');
const path = require('path');

// TODO - gulp tasks to transform foo.proto to fooproto.js
//     node_modules/protobufjs/bin/pbjs -t static-module -w commonjs \
//         -o fooproto.js foo.proto
// and from there to fooproto.d.ts
//     node_modules/protobufjs/bin/pbts -o fooproto.d.ts fooproto.js

gulp.task('copy', () => gulp
          .src('src/**/*.ts')
          .pipe(gulp.dest('build/')));
gulp.task('pb', () => gulp
          .src('src/**/*.proto')
          .pipe(pbjs())
          .pipe(gulp.dest('build/'))
          .pipe(pbts())
          .pipe(gulp.dest('build/')));
gulp.task('ts', ['copy', 'pb'], () => gulp
          .src(['build/**/*.ts', '!build/**/*.d.ts'])
          .pipe(sourcemaps.init())
          .pipe(ts({
            noImplicitAny: true,
            noImplicitThis: true,
            strictNullChecks: true,
            //inlineSourceMap: true,
            //inlineSources: true,
            //experimentalDecorators: true,
            //emitDecoratorMetadata: true,
            lib: ['ES2015'],
            //target: 'ES2015',
          }))
          .pipe(sourcemaps.write())
          .pipe(gulp.dest('build/')));
gulp.task('default', ['ts'], () => gulp
          .src('build/**/*.js')
          .pipe(gulp.dest('out/')));
          

function pbjs() {
  return spawnedProcess(
      'pbjs', ['-t', 'static-module', '-w', 'commonjs', '-'],
      path => path.replace(/\.proto$/, '.pb.js'));
}

function pbts() {
  return spawnedProcess(
      'pbts', ['-'], path => path.replace(/\.pb\.js$/, '.pb.d.ts'));
}

function spawnedProcess(command, args, pathTransform) {
  return through.obj((file, end, cb) => {
    if (file.isNull()) return cb(null, file);
    const opt = {env: process.env};
    opt.env.PATH = path.join(__dirname, 'node_modules', '.bin')
      + path.delimiter + opt.env.PATH;
    const job = spawn(command, args);
    if (file.isBuffer()) {
      job.stdin.end(file.contents);
    } else if (file.isStream()) {
      file.contents.pipe(job.stdin);
    } else {
      return cb(new Error('Unknown type ' + file), null);
    }
    return cb(null, new Vinyl({
      path: pathTransform(file.path),
      base: file.base,
      contents: job.stdout,
    }));
  });
}

