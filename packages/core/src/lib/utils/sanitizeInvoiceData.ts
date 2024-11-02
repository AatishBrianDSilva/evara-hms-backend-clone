import _ from 'lodash';
import { format, isValid, parseISO } from 'date-fns';
import { ISection } from '../types/global';

type InputObject = { [key: string]: any };

export const sanitizeInvoiceData = (input: ISection[]): ISection[] => {
  const formatKey = (key: string): string => {
    return _.startCase(_.camelCase(key));
  };

  const sanitizeContent = (content: InputObject): InputObject => {
    const sanitizedContent: InputObject = {};

    _.forOwn(content, (value, key) => {
      if (value !== '' && value !== null) {
        const formattedKey = formatKey(key);

        sanitizedContent[formattedKey] = value;
      }
    });

    return sanitizedContent;
  };

  const sanitizedSections: ISection[] = input.map(section => {
    const { title, showTitle, isBillDetails, content } = section || [];
    return {
      title,
      showTitle,
      isBillDetails,
      content: sanitizeContent(content),
    };
  });

  return sanitizedSections;
};
