import {ExtractedMessageDescriptor, Opts} from 'babel-plugin-react-intl/dist';
import * as babel from '@babel/core';
import {warn, getStdinAsString, clearLine} from './console_utils';
import keyBy from 'lodash/keyBy';

export type ExtractCLIOptions = Omit<Opts, 'overrideIdFn'>;

function getBabelConfig(
  reactIntlOptions: ExtractCLIOptions,
  extraBabelOptions: Partial<babel.TransformOptions> = {}
): babel.TransformOptions {
  return {
    babelrc: false,
    parserOpts: {
      plugins: ['jsx'],
    },
    plugins: [['babel-plugin-react-intl', reactIntlOptions]],
    highlightCode: true,
    // Extraction of string messages does not output the transformed JavaScript.
    sourceMaps: false,
    ...extraBabelOptions,
  };
}

function extractSingleFile(
  filename: string,
  extractOptions: ExtractCLIOptions
): babel.BabelFileResult | null {
  return babel.transformFileSync(
    filename,
    getBabelConfig(extractOptions, {filename})
  );
}

function getReactIntlMessages(
  babelResult: babel.BabelFileResult | null
): Record<string, ExtractedMessageDescriptor> {
  if (babelResult === null) {
    return {};
  } else {
    const messages: ExtractedMessageDescriptor[] = (babelResult.metadata as any)[
      'react-intl'
    ].messages;
    return keyBy(messages, 'id');
  }
}

export default async function extract(
  files: readonly string[],
  extractOptions: ExtractCLIOptions
) {
  const printMessagesToStdout = extractOptions.messagesDir == null;
  let extractedMessages: Record<string, ExtractedMessageDescriptor> = {};

  if (files.length > 0) {
    for (const file of files) {
      const babelResult = extractSingleFile(file, extractOptions);
      const singleFileExtractedMessages = getReactIntlMessages(babelResult);
      // We only need to aggregate result when we need to print to STDOUT.
      if (printMessagesToStdout) {
        Object.assign(extractedMessages, singleFileExtractedMessages);
      }
    }
  } else {
    if (files.length === 0 && process.stdin.isTTY) {
      warn('Reading source file from TTY.');
    }
    const stdinSource = await getStdinAsString();
    const babelResult = babel.transformSync(
      stdinSource,
      getBabelConfig(extractOptions)
    );
    if (printMessagesToStdout) {
      extractedMessages = getReactIntlMessages(babelResult);
    }
  }
  if (printMessagesToStdout) {
    process.stdout.write(
      JSON.stringify(Object.values(extractedMessages), null, 2)
    );
    process.stdout.write('\n');
  }
}
