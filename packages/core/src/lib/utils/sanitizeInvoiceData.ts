import _ from "lodash";
import { format, isValid, parseISO } from "date-fns";
import { ISection } from "../types/global";

type InputObject = { [key: string]: any };

export const sanitizeInvoiceData = (input: ISection[]): ISection[] => {
  const isDate = (value: any): boolean => {
    return !isNaN(Date.parse(value));
  };

  const formatDate = (date: string): string => {
    const parsedDate = parseISO(date);
    if (isValid(parsedDate)) {
      return format(parsedDate, "dd/MM/yyyy h:mm a");
    }
    return date; // Return the original value if it's not a valid date
  };

  const formatKey = (key: string): string => {
    return _.startCase(_.camelCase(key));
  };

  const sanitizeContent = (content: InputObject): InputObject => {
    const sanitizedContent: InputObject = {};

    _.forOwn(content, (value, key) => {
      if (value !== "" && value !== null) {
        const formattedKey = formatKey(key);
        if (typeof value === "string" && isDate(value)) {
          sanitizedContent[formattedKey] = formatDate(value);
        } else {
          sanitizedContent[formattedKey] = value;
        }
      }
    });

    return sanitizedContent;
  };

  const sanitizedSections: ISection[] = input.map((section) => {
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
