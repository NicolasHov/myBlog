/* eslint-disable import/no-extraneous-dependencies */

const Metalsmith = require("metalsmith");
const markdown = require("@metalsmith/markdown");
const layouts = require("@metalsmith/layouts");
const collections = require("@metalsmith/collections");
const drafts = require("@metalsmith/drafts");
const permalinks = require("@metalsmith/permalinks");
const when = require("metalsmith-if");
const htmlMinifier = require("metalsmith-html-minifier");
const assets = require("metalsmith-static-files");
const metadata = require("@metalsmith/metadata");
const prism = require("metalsmith-prism");

const marked = require("marked");

const { dependencies } = require("./package.json");

const isProduction = process.env.NODE_ENV === "production";

// functions to extend Nunjucks environment
const spaceToDash = (string) => string.replace(/\s+/g, "-");
const condenseTitle = (string) => string.toLowerCase().replace(/\s+/g, "");
const UTCdate = (date) => date.toUTCString("M d, yyyy");
const blogDate = (string) =>
  new Date(string).toLocaleString("en-US", { year: "numeric", month: "long", day: "numeric" });
const trimSlashes = (string) => string.replace(/(^\/)|(\/$)/g, "");
const md = (mdString) => {
  try {
    return marked.parse(mdString);
  } catch (e) {
    return mdString;
  }
};

// Define engine options for the inplace and layouts plugins
const templateConfig = {
  directory: "layouts",
  engineOptions: {
    path: ["layouts"],
    filters: {
      spaceToDash,
      condenseTitle,
      UTCdate,
      blogDate,
      trimSlashes,
      md,
    },
  },
};

function msBuild() {
  Metalsmith(__dirname)
    .source("./src/content")
    .destination("./build")
    .clean(true)
    .metadata({
      msVersion: dependencies.metalsmith,
      nodeVersion: process.version,
    })

    .use(when(isProduction, drafts()))

    .use(
      metadata({
        site: "src/content/data/site.json",
        nav: "src/content/data/navigation.json"
        // sitename: 'MyBlog',
        // // description: 'Its about saying »Hello« to the World',
        // generator: 'Metalsmith',
        // url: 'https://metalsmith.io/'
      })
    )

    .use(
      collections({
        blog: {
          pattern: "blog/*.md",
          sortBy: "date",
          reverse: true,
          limit: 10,
        },
      })
    )

    .use(markdown())

    .use(permalinks())

    .use(layouts(templateConfig))

    .use(
      prism({
        lineNumbers: true,
        decode: true,
      })
    )

    .use(
      assets({
        source: "src/assets/",
        destination: "assets/",
      })
    )

    .use(when(isProduction, htmlMinifier()))
    .build((err, files) => {
      if (err) throw err
      console.log('Build success')
    })
  }

  if (require.main === module) {
    msBuild();
  } else {
    module.exports = msBuild;
  }