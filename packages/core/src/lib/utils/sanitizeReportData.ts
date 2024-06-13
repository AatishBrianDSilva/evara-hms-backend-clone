import _ from "lodash";
import { format, isValid, parseISO } from "date-fns";
import { ISection } from "../types/global";

type InputObject = { [key: string]: any };

export const sanitizeReportInput = (input: InputObject): InputObject => {
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

  const sanitizedObject: InputObject = {};

  _.forOwn(input, (value, key) => {
    if (value !== "" && value !== null) {
      const formattedKey = formatKey(key);
      if (typeof value === "string" && isDate(value)) {
        sanitizedObject[formattedKey] = formatDate(value);
      } else {
        sanitizedObject[formattedKey] = value;
      }
    }
  });

  return sanitizedObject;
};

// export const transformBloodTestsToKeyValuePairs = (
//   details: any[]
// ): Record<string, string> => {
//   return details.reduce((acc, detail) => {
//     acc[detail.component] = `${detail.value} ${detail.unit} ${
//       detail.refernceRange && `(Reference Range: ${detail.refernceRange})}`
//     }`;
//     return acc;
//   }, {});
// };

export const transformBloodTestsToKeyValuePairs = (details: any[]): Record<string, string> => {
  if (!Array.isArray(details)) {
    return {}; // Return an empty object if details is not an array
  }

  return details.reduce((acc, detail) => {
    if (detail.component && detail.value !== undefined && detail.unit) {
      acc[detail.component] = `${detail.value} ${detail.unit} ${
        detail.referenceRange ? `(Reference Range: ${detail.referenceRange})` : ""
      }`;
    }
    return acc;
  }, {});
};

export const generateSections = (input: InputObject): ISection[] => {
  const sections: ISection[] = [];

  _.forOwn(input, (value, key) => {
    if (key === "doctor" && _.isObject(value)) {
      const doctorName = `${value.firstName} ${value.lastName}`;
      const sectionTitle = "General Information";
      let section = sections.find((section) => section.title === sectionTitle);

      if (!section) {
        section = {
          showTitle: true,
          title: sectionTitle,
          content: {},
        };
        sections.push(section);
      }

      section.content["Doctor"] = doctorName;
    } else if (_.isObject(value) && !_.isArray(value)) {
      const sectionContent = sanitizeReportInput(value as InputObject);
      if (!_.isEmpty(sectionContent)) {
        sections.push({
          showTitle: true,
          title: _.startCase(_.camelCase(key)),
          content: sectionContent,
        });
      }
    } else if (!_.isObject(value) && value !== "") {
      const sectionTitle = "General Information";
      let section = sections.find((section) => section.title === sectionTitle);

      if (!section) {
        section = {
          showTitle: true,
          title: sectionTitle,
          content: {},
        };
        sections.push(section);
      }

      section.content[_.startCase(_.camelCase(key))] = sanitizeReportInput({
        value,
      })["Value"];
    }
  });

  return sections;
};
